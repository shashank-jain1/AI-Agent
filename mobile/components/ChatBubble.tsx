import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Message } from '../hooks/useVoiceAgent'

interface Props { message: Message }

export default function ChatBubble({ message }: Props) {
    const isUser = message.role === 'user'

    return (
        <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
            {/* Bubble */}
            <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                {message.isTyping && message.text === '' ? (
                    <View style={styles.dotRow}>
                        {[0, 1, 2].map((i) => (
                            <View key={i} style={styles.dot} />
                        ))}
                    </View>
                ) : (
                    <Text style={styles.bubbleText}>{message.text}</Text>
                )}
            </View>

            {/* Source chips */}
            {!isUser && message.sources && message.sources.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourcesRow}>
                    {message.sources.map((src, i) => (
                        <View key={i} style={styles.chip}>
                            <Text style={styles.chipText}>📄 {src.filename} · Pg {src.page_number}</Text>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { marginVertical: 4 },
    userContainer: { alignItems: 'flex-end' },
    aiContainer: { alignItems: 'flex-start' },
    bubble: {
        maxWidth: '82%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    userBubble: {
        backgroundColor: '#2563EB',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: '#1a1a2e',
        borderWidth: 1,
        borderColor: '#333',
        borderBottomLeftRadius: 4,
    },
    bubbleText: {
        color: '#E8E8F0',
        fontSize: 14,
        lineHeight: 20,
    },
    dotRow: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
    sourcesRow: { marginTop: 6 },
    chip: {
        backgroundColor: '#1e1e3a',
        borderRadius: 100,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#333',
    },
    chipText: { color: '#888', fontSize: 11 },
})
