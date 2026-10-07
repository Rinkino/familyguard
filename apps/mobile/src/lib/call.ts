import { Linking } from 'react-native';
import { notice } from '@/components/ui';

/** Same rule as the database check on profiles.phone. */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

/** Opens the phone dialer for someone, or explains why it can't. */
export async function callPerson(name: string, phone: string | undefined | null) {
  if (!phone) {
    notice(`${name} hasn't added a phone number`, `Ask ${name} to add one under You, Phone number.`);
    return;
  }
  const url = `tel:${phone.replace(/[^+0-9]/g, '')}`;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  else notice("This device can't make calls", `${name}'s number is ${phone}.`);
}
