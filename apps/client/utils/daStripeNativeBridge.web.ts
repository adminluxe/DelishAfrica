export function getStripeNativeModule(): unknown {
  return null; // Web cannot load the native iOS/Android PaymentSheet.
}
