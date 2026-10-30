import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & { images: readonly string[] };
function ImageSequence({ images, ...props }: Props) {
  const [index, setIndex] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState('');
  const src = images[index];
  return src ? <img {...props} data-image-loaded={loadedSrc === src ? 'true' : 'false'} onLoad={event => {setLoadedSrc(src); props.onLoad?.(event);}} src={src} referrerPolicy="no-referrer" onError={() => setIndex(value => value + 1)} /> : null;
}
/** Try saved URLs in order, and reset failures when the artwork set changes. */
export function FallbackImage({ images, ...props }: Props) {
  const unique = [...new Set(images.filter(Boolean))];
  return <ImageSequence key={JSON.stringify(unique)} images={unique} {...props} />;
}
