
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useChurch } from '@/hooks/useChurch';
import { supabase } from '@/lib/supabase/client';

export default function ChurchScreen() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    loading,
    error,
    user,
    createChurch,
    addMember,
    deleteMember,
    updateMember,
  } = useChurch();

  const [isCreateChurchModalVisible, setCreateChurchModalVisible] = useState(false);
  const [isAddMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isSignOutModalVisible, setSignOutModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const [newChurchName, setNewChurchName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');

  const handleCreateChurch = async () => {
    console.log('User tapped Create Church button');
    if (!newChurchName.trim()) {
      return;
    }

    const result = await createChurch(newChurchName.trim());
    if (result) {
      setNewChurchName('');
      setCreateChurchModalVisible(false);
    }
  };

  const handleAddMember = async () => {
    console.log('User tapped Add Member button');
    if (!currentChurch || !newMemberEmail.trim()) {
      return;
    }

    const result = await addMember(
      currentChurch.id,
      newMemberEmail.trim(),
      newMemberName.trim() || undefined,
      newMemberRole.trim() || undefined
    );

    if (result) {
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRole('');
      setAddMemberModalVisible(false);
    }
  };

  const handleDeleteMember = async () => {
    console.log('User confirmed delete member');
    if (!memberToDelete || !currentChurch) {
      return;
    }

    const success = await deleteMember(memberToDelete, currentChurch.id);
    if (success) {
      setMemberToDelete(null);
      setDeleteModalVisible(false);
    }
  };

  const handleSignOut = async () => {
    console.log('User confirmed sign out');
    try {
      await supabase.auth.signOut();
      console.log('User signed out successfully');
      setSignOutModalVisible(false);
      router.replace('/onboarding');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const openDeleteModal = (memberId: string) => {
    console.log('User tapped delete member:', memberId);
    setMemberToDelete(memberId);
    setDeleteModalVisible(true);
  };

  if (loading && churches.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Church Management',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const noChurchesText = 'No churches yet';
  const createFirstChurchText = 'Create your first church to get started';
  const noMembersText = 'No members yet';
  const addFirstMemberText = 'Add members to your church';
  const signOutText = 'Sign Out';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Church Management',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('User tapped Sign Out');
                setSignOutModalVisible(true);
              }}
              style={styles.signOutButton}
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Church Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Churches</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                console.log('User tapped Create Church');
                setCreateChurchModalVisible(true);
              }}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {churches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {noChurchesText}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                {createFirstChurchText}
              </Text>
            </View>
          ) : (
            <View style={styles.churchList}>
              {churches.map((church) => {
                const isSelected = currentChurch?.id === church.id;
                return (
                  <TouchableOpacity
                    key={church.id}
                    style={[
                      styles.churchCard,
                      { backgroundColor: colors.cardBackground },
                      isSelected && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => {
                      console.log('User selected church:', church.name);
                      setCurrentChurch(church);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="building.2"
                      android_material_icon_name="home"
                      size={24}
                      color={isSelected ? colors.primary : colors.text}
                    />
                    <Text
                      style={[
                        styles.churchName,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                    >
                      {church.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Members Section */}
        {currentChurch && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  console.log('User tapped Add Member');
                  setAddMemberModalVisible(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="person.badge.plus"
                  android_material_icon_name="person-add"
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

            {members.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  {noMembersText}
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                  {addFirstMemberText}
                </Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {members.map((member) => {
                  const displayName = member.name || member.email;
                  const displayRole = member.role || '';
                  return (
                    <View
                      key={member.id}
                      style={[styles.memberCard, { backgroundColor: colors.cardBackground }]}
                    >
                      <View style={styles.memberInfo}>
                        <IconSymbol
                          ios_icon_name="person.circle"
                          android_material_icon_name="account-circle"
                          size={40}
                          color={colors.primary}
                        />
                        <View style={styles.memberDetails}>
                          <Text style={[styles.memberName, { color: colors.text }]}>
                            {displayName}
                          </Text>
                          <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                            {member.email}
                          </Text>
                          {displayRole && (
                            <Text style={[styles.memberRole, { color: colors.primary }]}>
                              {displayRole}
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => openDeleteModal(member.id)}
                        style={styles.deleteButton}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={20}
                          color="#ff3b30"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Create Church Modal */}
      <Modal
        visible={isCreateChurchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateChurchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Church</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Church Name"
              placeholderTextColor={colors.textSecondary}
              value={newChurchName}
              onChangeText={setNewChurchName}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled create church');
                  setCreateChurchModalVisible(false);
                  setNewChurchName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateChurch}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={isAddMemberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Member</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Email (required)"
              placeholderTextColor={colors.textSecondary}
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newMemberName}
              onChangeText={setNewMemberName}
            />

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Role (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newMemberRole}
              onChangeText={setNewMemberRole}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled add member');
                  setAddMemberModalVisible(false);
                  setNewMemberEmail('');
                  setNewMemberName('');
                  setNewMemberRole('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleAddMember}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Member</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to remove this member?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete');
                  setDeleteModalVisible(false);
                  setMemberToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteMember}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={isSignOutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign Out</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled sign out');
                  setSignOutModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSignOut}
              >
                <Text style={styles.saveButtonText}>{signOutText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutButton: {
    marginRight: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  churchList: {
    gap: 12,
  },
  churchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  churchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
