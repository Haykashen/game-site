import brandMark from '../assets/discvault-mark.svg';
import { cx } from '../lib/cx';

interface BrandMarkProps {
  className?: string;
  size?: number;
}

/** Square vault-door mark used in the app chrome and mirrored by the favicon. */
export function BrandMark({ className, size = 40 }: BrandMarkProps) {
  return (
    <img
      src={brandMark}
      alt=""
      width={size}
      height={size}
      className={cx('brand-mark', className)}
      draggable={false}
    />
  );
}
