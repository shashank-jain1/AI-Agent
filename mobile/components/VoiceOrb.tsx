import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, Easing } from 'react-native'
import { AgentStatus } from '../hooks/useVoiceAgent'

interface Props { status: AgentStatus }

export default function VoiceOrb({ status }: Props) {
    const scaleAnim = useRef(new Animated.Value(1)).current
    const rotateAnim = useRef(new Animated.Value(0)).current
    const ring1Anim = useRef(new Animated.Value(0)).current
    const ring2Anim = useRef(new Animated.Value(0)).current
    const ring3Anim = useRef(new Animated.Value(0)).current

    // ── Fix: declare each bar anim as a distinct ref (no .map) ───────────────
    const bar0Anim = useRef(new Animated.Value(8)).current
    const bar1Anim = useRef(new Animated.Value(8)).current
    const bar2Anim = useRef(new Animated.Value(8)).current
    const bar3Anim = useRef(new Animated.Value(8)).current
    const bar4Anim = useRef(new Animated.Value(8)).current
    const barAnims = [bar0Anim, bar1Anim, bar2Anim, bar3Anim, bar4Anim]

    const ringAnims = [ring1Anim, ring2Anim, ring3Anim]

    useEffect(() => {
        // Stop all animations first
        ;[scaleAnim, rotateAnim, ring1Anim, ring2Anim, ring3Anim, ...barAnims].forEach(
            (a) => a.stopAnimation()
        )

        if (status === 'idle') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.08, duration: 1500, useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease),
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1, duration: 1500, useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease),
                    }),
                ])
            ).start()
        } else if (status === 'listening') {
            ringAnims.forEach((anim, i) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.delay(i * 500),
                        Animated.timing(anim, {
                            toValue: 1, duration: 1500, useNativeDriver: true,
                            easing: Easing.out(Easing.ease),
                        }),
                        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
                    ])
                ).start()
            })
        } else if (status === 'processing') {
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.linear,
                })
            ).start()
        } else if (status === 'speaking') {
            const durations = [300, 400, 350, 450, 320]
            barAnims.forEach((anim, i) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, { toValue: 32, duration: durations[i], useNativeDriver: false }),
                        Animated.timing(anim, { toValue: 8, duration: durations[i], useNativeDriver: false }),
                    ])
                ).start()
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    const orbColor =
        status === 'speaking' ? '#22C55E'
            : status === 'listening' ? '#3B82F6'
                : status === 'processing' ? '#8B5CF6'
                    : '#3B82F6'

    const rotateInterpolate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    return (
        <View style={styles.container}>
            {/* Listening rings */}
            {status === 'listening' &&
                ringAnims.map((anim, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.ring,
                            {
                                opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                                borderColor: '#3B82F6',
                            },
                        ]}
                    />
                ))}

            {/* Processing ring */}
            {status === 'processing' && (
                <Animated.View
                    style={[styles.spinRing, { transform: [{ rotate: rotateInterpolate }] }]}
                />
            )}

            {/* Core orb */}
            <Animated.View
                style={[
                    styles.orb,
                    { backgroundColor: orbColor, transform: [{ scale: status === 'idle' ? scaleAnim : 1 }] },
                ]}
            >
                {status === 'speaking' && (
                    <View style={styles.bars}>
                        {barAnims.map((anim, i) => (
                            <Animated.View key={i} style={[styles.bar, { height: anim }]} />
                        ))}
                    </View>
                )}
            </Animated.View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginVertical: 12,
    },
    ring: {
        position: 'absolute',
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 2,
    },
    spinRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#8B5CF6',
        borderTopColor: '#3B82F6',
    },
    orb: {
        width: 104,
        height: 104,
        borderRadius: 52,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowRadius: 20,
        shadowOpacity: 0.6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
    },
    bars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 3,
        height: 40,
    },
    bar: {
        width: 5,
        backgroundColor: '#fff',
        borderRadius: 3,
    },
})
