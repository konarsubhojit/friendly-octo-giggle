import AccountClient from "@/app/account/AccountClient";

export {
  isPasswordStrong,
  validatePasswordFields,
  validateProfileFields,
} from "@/app/account/account-shared";

export default function AccountPage() {
  return <AccountClient />;
}
