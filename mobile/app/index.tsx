import React, { useState, useRef } from 'react'
import {
    SafeAreaView, View, FlatList, Text, TextInput,
    TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useVoiceAgent } from '../hooks/useVoiceAgent'
import VoiceOrb from '../components/VoiceOrb'
import ChatBubble from '../components/ChatBubble'

type Lang = 'en' | 'hi'

export default function HomeScreen() {
    const [language, setLanguage] = useState<Lang>('en')
    const { status, transcript, messages, startRecording, stopRecording, sendText } =
        useVoiceAgent(language)
    const inputRef = useRef<TextInput>(null)

    const statusLabel = {
        idle: language === 'hi' ? 'बोलने के लिए माइक दबाएं' : 'Tap mic to speak',
        listening: language === 'hi' ? 'सुन रहा हूँ…' : 'Listening…',
        processing: language === 'hi' ? 'सोच रहा हूँ…' : 'Thinking…',
        speaking: language === 'hi' ? 'बोल रहा हूँ…' : 'Speaking…',
    }

    const handleSend = (text: string) => {
        if (text.trim()) {
            sendText(text.trim())
            inputRef.current?.clear()
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.logo}>◈ VoiceBot</Text>
                <View style={styles.langToggle}>
                    {(['en', 'hi'] as Lang[]).map((lang) => (
                        <TouchableOpacity
                            key={lang}
                            onPress={() => setLanguage(lang)}
                            style={[styles.langBtn, language === lang && styles.langBtnActive]}
                        >
                            <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                                {lang === 'en' ? 'EN' : 'हि'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Chat */}
            <FlatList
                data={[...messages].reverse()}
                inverted
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ChatBubble message={item} />}
                contentContainerStyle={styles.chatList}
                showsVerticalScrollIndicator={false}
            />

            {/* Controls */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.controls}>
                    {/* Orb */}
                    <VoiceOrb status={status} />

                    {/* Status text */}
                    <Text style={styles.statusText}>
                        {transcript ? transcript : statusLabel[status]}
                    </Text>

                    {/* Mic button */}
                    <TouchableOpacity
                        onPress={status === 'listening' ? stopRecording : startRecording}
                        disabled={status === 'processing' || status === 'speaking'}
                        style={[styles.micBtn, status === 'listening' && styles.micBtnActive]}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.micIcon}>{status === 'listening' ? '⬛' : '🎤'}</Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>
                            {language === 'hi' ? 'या टाइप करें' : 'or type below'}
                        </Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Text input */}
                    <View style={styles.inputRow}>
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder={language === 'hi' ? 'यहाँ टाइप करें…' : 'Type your question…'}
                            placeholderTextColor="#555"
                            returnKeyType="send"
                            onSubmitEditing={(e) => handleSend(e.nativeEvent.text)}
                            editable={status === 'idle'}
                        />
                        <TouchableOpacity
                            style={styles.sendBtn}
                            onPress={() => {
                                const val = (inputRef.current as any)?._lastNativeText
                                if (val) handleSend(val)
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 16 }}>→</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#070710' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    logo: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    langToggle: {
        flexDirection: 'row',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: 3,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    langBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
    langBtnActive: { backgroundColor: '#2563EB' },
    langText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
    langTextActive: { color: '#fff' },
    chatList: { paddingHorizontal: 16, paddingVertical: 8 },
    controls: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
    },
    statusText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 12 },
    micBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    micBtnActive: { backgroundColor: '#EF4444' },
    micIcon: { fontSize: 28 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
    dividerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, marginHorizontal: 10 },
    inputRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#E8E8F0',
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
    },
    sendBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-end',
    },
})
