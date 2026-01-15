import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent, PanResponderGestureState, Pressable, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type Stroke = string;

export default function SignaturePad({ onClear, onExport }: { onClear: () => void; onExport: (svgPathData: string) => void }) {
  const [d, setD] = useState<Stroke>('');
  const pathRef = useRef<string>('');
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      const { locationX:x, locationY:y } = e.nativeEvent;
      pathRef.current = `M ${x} ${y}`;
      setD(pathRef.current);
    },
    onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
      const { moveX:x, moveY:y } = g;
      pathRef.current += ` L ${x} ${y}`;
      setD(pathRef.current);
    },
  }), []);
  const clear = () => { pathRef.current = ''; setD(''); onClear(); };
  const exportData = () => onExport(d);

  return (
    <View>
      <View style={styles.box} {...pan.panHandlers}>
        <Svg style={{ flex: 1 }}>
          <Rect x="0" y="0" width="100%" height="100%" fill="#fff" />
          {d ? <Path d={d} stroke="#111" strokeWidth={2} fill="none" /> : null}
        </Svg>
      </View>
      <View style={styles.row}>
        <Pressable onPress={clear} style={[styles.btn, styles.ghost]}><Text style={styles.txt}>Effacer</Text></Pressable>
        <Pressable onPress={exportData} style={[styles.btn, styles.primary]}><Text style={styles.txt}>Utiliser la signature</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  box: { height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', backgroundColor: 'white' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  primary: { backgroundColor: '#1e40af' },
  ghost: { backgroundColor: '#6b7280' },
  txt: { color: '#fff', fontWeight: '700' },
});
