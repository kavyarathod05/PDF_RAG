import { SignUp } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return <SignUp routing="path" path="/sso-callback" />;
}
