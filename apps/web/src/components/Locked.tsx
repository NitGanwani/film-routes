import { Icon } from './Icon.js';

/** Content that opens later: shown as deliberately locked, not as missing. */
export function Locked({ text }: { text: string }) {
  return (
    <div className="locked">
      <Icon name="lock" size={18} />
      <span>{text}</span>
    </div>
  );
}
