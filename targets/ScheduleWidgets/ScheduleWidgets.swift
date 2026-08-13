import SwiftUI
import WidgetKit

private let appGroupIdentifier = "group.com.lbkchano.musicministry.widgets"
private let snapshotKey = "musicMinistry.scheduleWidget.snapshot.v1"
private let snapshotSchemaVersion = 1
private let staleInterval: TimeInterval = 24 * 60 * 60
private let scheduleURL = URL(string: "musicministry://")!

private enum ScheduleWidgetPalette {
    static let background = Color(red: 0.024, green: 0.082, blue: 0.184)
    static let accent = Color(red: 0.412, green: 0.776, blue: 1.0)
}

private enum ScheduleWidgetMode: Equatable {
    case church
    case member

    var title: String {
        switch self {
        case .church: return "Next Church Service"
        case .member: return "My Next Assignment"
        }
    }

    var compactTitle: String {
        switch self {
        case .church: return "Next Service"
        case .member: return "My Assignment"
        }
    }

    var systemImage: String {
        switch self {
        case .church: return "calendar"
        case .member: return "person.crop.circle.badge.checkmark"
        }
    }
}

private enum ScheduleWidgetContentState: Equatable {
    case ready
    case signedOut
    case noChurch
    case unavailable
    case stale
    case empty
}

private struct StoredScheduleTeamMember: Codable, Hashable {
    let role: String
    let memberName: String
}

private struct ScheduleWidgetTeamTypography {
    let fontSize: CGFloat
    let minimumScaleFactor: CGFloat
    let rowSpacing: CGFloat
}

private struct StoredScheduleService: Codable, Identifiable {
    let serviceId: String
    let date: String
    let time: String?
    let serviceType: String
    let roles: [String]
    let team: [StoredScheduleTeamMember]?

    var id: String { serviceId }
}

private struct StoredScheduleSnapshot: Codable {
    let schemaVersion: Int
    let state: String
    let generatedAt: String
    let scopeFingerprint: String?
    let churchName: String?
    let churchServices: [StoredScheduleService]
    let memberServices: [StoredScheduleService]
}

private func localServiceDate(_ service: StoredScheduleService) -> Date? {
    let dateParts = service.date.split(separator: "-").compactMap { Int($0) }
    guard dateParts.count == 3 else { return nil }
    var components = DateComponents()
    components.year = dateParts[0]
    components.month = dateParts[1]
    components.day = dateParts[2]

    if let time = service.time {
        let timeParts = time.split(separator: ":").compactMap { Int($0) }
        guard timeParts.count >= 2 else { return nil }
        components.hour = timeParts[0]
        components.minute = timeParts[1]
        components.second = timeParts.count > 2 ? timeParts[2] : 0
    } else {
        components.hour = 0
        components.minute = 0
        components.second = 0
    }
    return Calendar.current.date(from: components)
}

private struct ScheduleWidgetEntry: TimelineEntry {
    let date: Date
    let mode: ScheduleWidgetMode
    let state: ScheduleWidgetContentState
    let churchName: String?
    let services: [StoredScheduleService]

    static func placeholder(mode: ScheduleWidgetMode) -> ScheduleWidgetEntry {
        ScheduleWidgetEntry(
            date: Date(),
            mode: mode,
            state: .ready,
            churchName: "Music Ministry",
            services: [
                StoredScheduleService(
                    serviceId: "preview-service",
                    date: "2026-08-09",
                    time: "09:00:00",
                    serviceType: "Sunday Morning",
                    roles: mode == .member ? ["Vocals"] : [],
                    team: mode == .church
                        ? [
                            StoredScheduleTeamMember(role: "Worship Leader", memberName: "Lisandro"),
                            StoredScheduleTeamMember(role: "Piano", memberName: "Elly")
                        ]
                        : nil
                )
            ]
        )
    }
}

private struct ScheduleTimelineProvider: TimelineProvider {
    let mode: ScheduleWidgetMode

    func placeholder(in context: Context) -> ScheduleWidgetEntry {
        .placeholder(mode: mode)
    }

    func getSnapshot(
        in context: Context,
        completion: @escaping (ScheduleWidgetEntry) -> Void
    ) {
        if context.isPreview {
            completion(.placeholder(mode: mode))
            return
        }
        completion(makeEntry(at: Date()))
    }

    func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<ScheduleWidgetEntry>) -> Void
    ) {
        let now = Date()
        guard let snapshot = loadSnapshot() else {
            let entry = ScheduleWidgetEntry(
                date: now,
                mode: mode,
                state: .unavailable,
                churchName: nil,
                services: []
            )
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(4 * 60 * 60))))
            return
        }

        var entries = [entry(from: snapshot, at: now)]
        if snapshot.state == "ready" && !isStale(snapshot, at: now) {
            let services = services(from: snapshot)
            let boundaries = services.compactMap(serviceExpiry).filter { $0 > now }
            for boundary in boundaries.prefix(4) {
                entries.append(entry(from: snapshot, at: boundary.addingTimeInterval(1)))
            }
        }

        let refreshDate = min(
            now.addingTimeInterval(4 * 60 * 60),
            generatedDate(snapshot)?.addingTimeInterval(staleInterval) ?? now.addingTimeInterval(60 * 60)
        )
        completion(Timeline(entries: entries, policy: .after(max(refreshDate, now.addingTimeInterval(15 * 60)))))
    }

    private func makeEntry(at date: Date) -> ScheduleWidgetEntry {
        guard let snapshot = loadSnapshot() else {
            return ScheduleWidgetEntry(
                date: date,
                mode: mode,
                state: .unavailable,
                churchName: nil,
                services: []
            )
        }
        return entry(from: snapshot, at: date)
    }

    private func loadSnapshot() -> StoredScheduleSnapshot? {
        guard
            let defaults = UserDefaults(suiteName: appGroupIdentifier),
            let value = defaults.string(forKey: snapshotKey),
            let data = value.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(StoredScheduleSnapshot.self, from: data),
            snapshot.schemaVersion == snapshotSchemaVersion
        else {
            return nil
        }
        return snapshot
    }

    private func entry(
        from snapshot: StoredScheduleSnapshot,
        at date: Date
    ) -> ScheduleWidgetEntry {
        let state: ScheduleWidgetContentState
        switch snapshot.state {
        case "signed_out": state = .signedOut
        case "no_church": state = .noChurch
        case "unavailable": state = .unavailable
        case "ready": state = isStale(snapshot, at: date) ? .stale : .ready
        default: state = .unavailable
        }

        let upcoming = state == .ready
            ? Array(services(from: snapshot).filter { isVisible($0, at: date) }.prefix(1))
            : []
        return ScheduleWidgetEntry(
            date: date,
            mode: mode,
            state: state == .ready && upcoming.isEmpty ? .empty : state,
            churchName: snapshot.churchName,
            services: upcoming
        )
    }

    private func services(from snapshot: StoredScheduleSnapshot) -> [StoredScheduleService] {
        mode == .church ? snapshot.churchServices : snapshot.memberServices
    }

    private func generatedDate(_ snapshot: StoredScheduleSnapshot) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: snapshot.generatedAt) {
            return date
        }
        return ISO8601DateFormatter().date(from: snapshot.generatedAt)
    }

    private func isStale(_ snapshot: StoredScheduleSnapshot, at date: Date) -> Bool {
        guard let generatedAt = generatedDate(snapshot) else { return true }
        return date.timeIntervalSince(generatedAt) > staleInterval
    }

    private func serviceDate(_ service: StoredScheduleService) -> Date? {
        localServiceDate(service)
    }

    private func serviceExpiry(_ service: StoredScheduleService) -> Date? {
        guard let start = serviceDate(service) else { return nil }
        if service.time == nil {
            return Calendar.current.date(byAdding: .day, value: 1, to: start)
        }
        return start
    }

    private func isVisible(_ service: StoredScheduleService, at date: Date) -> Bool {
        guard let expiry = serviceExpiry(service) else { return false }
        return expiry > date
    }
}

private struct ScheduleWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ScheduleWidgetEntry

    var body: some View {
        Group {
            if entry.state == .ready, let service = entry.services.first {
                readyView(service)
                    .privacySensitive()
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(accessibilitySummary(service))
            } else {
                emptyView
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground(ScheduleWidgetPalette.background)
        .widgetURL(scheduleURL)
    }

    private func readyView(_ service: StoredScheduleService) -> some View {
        Group {
            if entry.mode == .church {
                churchServiceView(service)
            } else {
                memberAssignmentView(service)
            }
        }
    }

    @ViewBuilder
    private func churchServiceView(_ service: StoredScheduleService) -> some View {
        if family == .systemMedium {
            GeometryReader { geometry in
                HStack(alignment: .top, spacing: 10) {
                    serviceSummary(service)
                        .frame(width: max(108, geometry.size.width * 0.4), alignment: .leading)
                        .frame(maxHeight: .infinity, alignment: .leading)
                    Divider().overlay(.white.opacity(0.18))
                    teamList(service, limit: 4)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                modeHeading
                Text(service.serviceType)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(formattedSchedule(service))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ScheduleWidgetPalette.accent)
                    .widgetAccentable()
                    .lineLimit(1)
                Divider().overlay(.white.opacity(0.18))
                teamList(service, limit: 2)
            }
        }
    }

    private func serviceSummary(_ service: StoredScheduleService) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            modeHeading
            Text(entry.churchName ?? "Church")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.72))
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .allowsTightening(true)
            Spacer(minLength: 0)
            Text(service.serviceType)
                .font(.system(.headline, design: .rounded, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.78)
                .allowsTightening(true)
            Text(formattedSchedule(service))
                .font(.caption.weight(.semibold))
                .foregroundStyle(ScheduleWidgetPalette.accent)
                .widgetAccentable()
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .allowsTightening(true)
        }
    }

    private func memberAssignmentView(_ service: StoredScheduleService) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            modeHeading
            Text(entry.churchName ?? "Church")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.72))
                .lineLimit(2)
            Spacer(minLength: 0)
            Text(service.serviceType)
                .font(.system(.headline, design: .rounded, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
            Text(formattedSchedule(service))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ScheduleWidgetPalette.accent)
                .widgetAccentable()
                .lineLimit(1)
            if !service.roles.isEmpty {
                Label(service.roles.joined(separator: ", "), systemImage: "music.note")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(2)
            }
        }
    }

    private var modeHeading: some View {
        Label(entry.mode.compactTitle, systemImage: entry.mode.systemImage)
            .font(.caption2.weight(.bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .allowsTightening(true)
    }

    private func teamList(_ service: StoredScheduleService, limit: Int) -> some View {
        let team = service.team ?? []
        let visibleTeam = Array(team.prefix(limit))
        let showsOverflow = team.count > limit && family == .systemMedium
        let typography = teamTypography(
            for: visibleTeam,
            includesOverflowRow: showsOverflow
        )
        return VStack(alignment: .leading, spacing: typography.rowSpacing) {
            Label(
                team.isEmpty ? "Team" : "Team (\(team.count))",
                systemImage: "person.2.fill"
            )
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.78))
                .lineLimit(1)
                .accessibilityLabel(
                    team.isEmpty ? "Assigned Team" : "Assigned Team, \(team.count) members"
                )
            if team.isEmpty {
                Text("No team assigned yet")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.white.opacity(0.68))
                    .lineLimit(2)
            } else {
                ForEach(visibleTeam, id: \.self) { member in
                    (Text(member.role).bold() + Text(" · ") + Text(member.memberName))
                        .font(.system(size: typography.fontSize, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.92))
                        .lineLimit(1)
                        .minimumScaleFactor(typography.minimumScaleFactor)
                        .allowsTightening(true)
                }
                if showsOverflow {
                    Text("+\(team.count - limit) more")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.62))
                        .lineLimit(1)
                }
            }
        }
    }

    private func teamTypography(
        for visibleTeam: [StoredScheduleTeamMember],
        includesOverflowRow: Bool
    ) -> ScheduleWidgetTeamTypography {
        let visibleRowCount = visibleTeam.count + (includesOverflowRow ? 1 : 0)
        let longestEntry = visibleTeam
            .map { $0.role.count + $0.memberName.count + 3 }
            .max() ?? 0

        let baseSize: CGFloat
        switch visibleRowCount {
        case 0, 1: baseSize = 13.5
        case 2: baseSize = 12
        case 3: baseSize = 11
        default: baseSize = 10
        }

        let lengthAdjustment: CGFloat
        switch longestEntry {
        case 37...: lengthAdjustment = 1.5
        case 29...: lengthAdjustment = 1
        case 23...: lengthAdjustment = 0.5
        default: lengthAdjustment = 0
        }

        let spacing: CGFloat
        switch visibleRowCount {
        case 0, 1: spacing = 7
        case 2: spacing = 5
        case 3: spacing = 4
        default: spacing = 3
        }

        return ScheduleWidgetTeamTypography(
            fontSize: max(9.5, baseSize - lengthAdjustment),
            minimumScaleFactor: longestEntry > 32 ? 0.68 : 0.76,
            rowSpacing: spacing
        )
    }

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 10) {
            modeHeading
            Spacer(minLength: 0)
            Image(systemName: emptySymbol)
                .font(.title2)
                .foregroundStyle(ScheduleWidgetPalette.accent)
                .widgetAccentable()
            Text(emptyTitle)
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(2)
            Text(emptyMessage)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.72))
                .lineLimit(3)
        }
        .accessibilityElement(children: .combine)
    }

    private var emptyTitle: String {
        switch entry.state {
        case .signedOut: return "Sign in to continue"
        case .noChurch: return "No church selected"
        case .empty:
            return entry.mode == .church ? "No upcoming services" : "No upcoming assignments"
        case .stale: return "Schedule may be out of date"
        default: return "Schedule unavailable"
        }
    }

    private var emptyMessage: String {
        switch entry.state {
        case .signedOut: return "Open Music Ministry to sign in."
        case .noChurch: return "Open Music Ministry to choose a church."
        case .empty: return "Open Music Ministry to view the schedule."
        default: return "Open Music Ministry to refresh."
        }
    }

    private var emptySymbol: String {
        switch entry.state {
        case .signedOut: return "person.crop.circle.badge.exclamationmark"
        case .noChurch: return "building.2"
        case .empty: return "calendar.badge.checkmark"
        case .stale: return "arrow.clockwise.circle"
        default: return "exclamationmark.circle"
        }
    }

    private func formattedSchedule(_ service: StoredScheduleService) -> String {
        guard let date = displayDate(service) else { return "Date unavailable" }
        let dateText = date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        guard service.time != nil else { return dateText }
        return "\(dateText) • \(date.formatted(date: .omitted, time: .shortened))"
    }

    private func displayDate(_ service: StoredScheduleService) -> Date? {
        localServiceDate(service)
    }

    private func accessibilitySummary(_ service: StoredScheduleService) -> String {
        var parts = [entry.mode.title, entry.churchName ?? "Church", service.serviceType, formattedSchedule(service)]
        if entry.mode == .member && !service.roles.isEmpty {
            parts.append("Roles: \(service.roles.joined(separator: ", "))")
        }
        if entry.mode == .church, let team = service.team, !team.isEmpty {
            parts.append("Assigned team: \(team.map { "\($0.role), \($0.memberName)" }.joined(separator: "; "))")
        }
        return parts.joined(separator: ". ")
    }
}

private extension View {
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            background(color)
        }
    }
}

private struct NextChurchServiceWidget: Widget {
    let kind = "MusicMinistryNextChurchService"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: ScheduleTimelineProvider(mode: .church)
        ) { entry in
            ScheduleWidgetView(entry: entry)
        }
        .configurationDisplayName("Next Church Service")
        .description("See the next scheduled service for your selected church.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct MyNextAssignmentWidget: Widget {
    let kind = "MusicMinistryMyNextAssignment"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: ScheduleTimelineProvider(mode: .member)
        ) { entry in
            ScheduleWidgetView(entry: entry)
        }
        .configurationDisplayName("My Next Assignment")
        .description("See the next service where you are assigned to a role.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct MusicMinistryScheduleWidgets: WidgetBundle {
    var body: some Widget {
        NextChurchServiceWidget()
        MyNextAssignmentWidget()
    }
}
