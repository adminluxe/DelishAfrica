use strict;
use warnings;

# Entire-file editing: expected to be used with -0777
my $s = $_;

# 1) Force scrollEnabled={false} => true
$s =~ s/scrollEnabled\s*=\s*\{\s*false\s*\}/scrollEnabled={true}/g;

# 2) Neutralize responder capture (major scroll killer)
# Conservative patterns: replace simple {...} blocks
$s =~ s/onStartShouldSetResponderCapture\s*=\s*\{[^}]*\}/onStartShouldSetResponderCapture={() => false}/g;
$s =~ s/onMoveShouldSetResponderCapture\s*=\s*\{[^}]*\}/onMoveShouldSetResponderCapture={() => false}/g;
$s =~ s/onStartShouldSetResponder\s*=\s*\{[^}]*\}/onStartShouldSetResponder={() => false}/g;
$s =~ s/onMoveShouldSetResponder\s*=\s*\{[^}]*\}/onMoveShouldSetResponder={() => false}/g;

# 3) Neutralize RNGH wrapper tags => Fragment
$s =~ s/<(GestureDetector|PanGestureHandler|TapGestureHandler|LongPressGestureHandler|FlingGestureHandler|NativeViewGestureHandler)\b[^>]*>/<>/sg;
$s =~ s#</(GestureDetector|PanGestureHandler|TapGestureHandler|LongPressGestureHandler|FlingGestureHandler|NativeViewGestureHandler)>#</>#sg;

# 4) Remove PanResponder spread handlers: {...X.panHandlers}
$s =~ s/\{\s*\.{3}\s*[\w.]+\s*\.panHandlers\s*\}//sg;

# 5) TouchSafe for known overlay components (if missing pointerEvents)
# For backgrounds/overlays: "none" is safest (doesn't capture)
$s =~ s/<(BlurView|LinearGradient|ImageBackground|Svg|SvgXml|LottieView|Canvas|SkiaView)\b(?![^>]*\bpointerEvents\s*=)([^>]*)>/<${1} pointerEvents="none"${2}>/sg;

# 6) TouchSafe for generic absolute overlays (View/Animated.View/Pressable/Touchables)
# Add pointerEvents="box-none" when style hints absolute overlay and pointerEvents absent.
$s =~ s{
  <(View|Animated\.View|Pressable|SafeAreaView|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight)
  \b
  (?![^>]*\bpointerEvents\s*=)
  ([^>]*\bstyle\s*=\s*\{[^>]*?(?:StyleSheet\.absoluteFill|absoluteFillObject|absoluteFill|position\s*:\s*['"]absolute['"]|zIndex\s*:)[^>]*?\}[^>]*)
  >
}{
  "<$1 pointerEvents=\"box-none\"$2>"
}xsg;

$_ = $s;
