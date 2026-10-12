import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#E8651A', '#2D5A27', '#A8D5A2', '#F2C14E', '#C73E2E', '#4C8BF5'];
const COUNT = 42;

// A one-shot confetti burst from the top-centre of the screen. Pure Animated (no extra
// native module, so it ships in an OTA). pointerEvents none: it never blocks touches.
export default function Confetti({ onDone }) {
    const { width, height } = Dimensions.get('window');
    const pieces = useRef(
        Array.from({ length: COUNT }, (_, i) => ({
            x: new Animated.Value(0),
            y: new Animated.Value(0),
            r: new Animated.Value(0),
            o: new Animated.Value(1),
            dx: (Math.random() - 0.5) * width * 1.1,
            fall: height * (0.55 + Math.random() * 0.45),
            spin: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4),
            color: COLORS[i % COLORS.length],
            size: 7 + Math.random() * 7,
            delay: Math.random() * 350,
        }))
    ).current;

    useEffect(() => {
        const anims = pieces.map((p) => Animated.parallel([
            Animated.timing(p.x, { toValue: p.dx, duration: 2200, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.y, { toValue: p.fall, duration: 2200, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.r, { toValue: p.spin, duration: 2200, delay: p.delay, useNativeDriver: true }),
            Animated.timing(p.o, { toValue: 0, duration: 700, delay: p.delay + 1700, useNativeDriver: true }),
        ]));
        Animated.parallel(anims).start(() => onDone && onDone());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {pieces.map((p, i) => (
                <Animated.View
                    key={i}
                    style={{
                        position: 'absolute',
                        top: 40,
                        left: width / 2,
                        width: p.size,
                        height: p.size * 0.55,
                        backgroundColor: p.color,
                        borderRadius: 2,
                        opacity: p.o,
                        transform: [
                            { translateX: p.x },
                            { translateY: p.y },
                            { rotate: p.r.interpolate({ inputRange: [-6, 6], outputRange: ['-2160deg', '2160deg'] }) },
                        ],
                    }}
                />
            ))}
        </View>
    );
}
