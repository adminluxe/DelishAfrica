declare const require: any;
export function getStripeNativeModule(): unknown {
  return require("@stripe/stripe-react-native");
}
