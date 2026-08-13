import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';

export default function NotFoundScreen() {
    const theme = useAppTheme();
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>This screen doesn't exist.</Text>
                <Link href="/" style={styles.link}>
                    <Text style={[styles.linkText, { color: theme.colors.accent }]}>Go to home screen!</Text>
                </Link>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
    },
    linkText: {
        fontSize: 14,
    },
});
