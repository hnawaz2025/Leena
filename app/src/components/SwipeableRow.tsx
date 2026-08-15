import { Trash2 } from "lucide-react-native";
import { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  // The bottom margin the wrapped row carries, so the delete action lines up
  // with the row itself rather than the gap below it.
  bottomInset?: number;
}

const ACTION_WIDTH = 76;
// How far left the row must travel before releasing snaps it open rather than
// closed -- low enough that a deliberate swipe always sticks, high enough that
// a slightly-off vertical scroll doesn't leave the row hanging open.
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

// Swipe left to reveal a delete action. Built on PanResponder rather than
// react-native-gesture-handler's Swipeable so this needs no new native
// dependency and no babel/reanimated setup.
export function SwipeableRow({ children, onDelete, bottomInset = spacing.md }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  function slideTo(value: number) {
    openRef.current = value !== 0;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once it's clearly horizontal, otherwise the
      // FlatList can never scroll vertically through these rows.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 8,
      onPanResponderMove: (_e, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const next = Math.min(0, Math.max(-ACTION_WIDTH, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const finalX = base + g.dx;
        slideTo(finalX < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0);
      },
      onPanResponderTerminate: () => slideTo(openRef.current ? -ACTION_WIDTH : 0),
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.actionLayer, { paddingBottom: bottomInset }]}>
        <Pressable
          style={styles.deleteButton}
          onPress={() => {
            slideTo(0);
            onDelete();
          }}
          accessibilityLabel="Delete"
        >
          <Trash2 size={20} color={colors.white} strokeWidth={2} />
        </Pressable>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  // Sits behind the row and is revealed as it slides, rather than being
  // animated in alongside it.
  actionLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  deleteButton: {
    width: ACTION_WIDTH - spacing.md,
    height: "100%",
    borderRadius: radius.card,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
});
