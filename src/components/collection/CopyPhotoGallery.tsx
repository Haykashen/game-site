import { Image as ImageIcon, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import { PhotoLightbox } from '../ui/PhotoLightbox';
import { PhotoPicker } from '../market/PhotoPicker';

interface Props {coverPhotos?: readonly string[]; useEditionCover?: boolean; onUseEditionCoverChange?: (value: boolean) => void; photos: readonly string[]; title: string; caption: string; editing: boolean; disabled: boolean; onChange: (photos: string[]) => void; onBusyChange: (busy: boolean) => void}
/** Editable thumbnails and the enlarged viewer share the same ordered photo list. */
export function CopyPhotoGallery({photos, title, caption, editing, disabled, onChange, onBusyChange, coverPhotos = [], useEditionCover = false, onUseEditionCoverChange}: Props) {
  const [selected, setSelected] = useState<string | undefined>(photos[0]);
  const [expanded, setExpanded] = useState(false);
  const displayPhotos = useEditionCover ? coverPhotos : photos;
  const index = Math.max(0, displayPhotos.findIndex(photo => photo === selected));
  const photo = displayPhotos[index];
  return <div className="copy-gallery">
    {photo ? <button type="button" className="copy-gallery__stage" aria-label="Открыть фотографию крупно" onClick={() => setExpanded(true)}>
      <img src={photo} alt={`Фото ${index + 1}: ${title}`} /><span className="copy-gallery__zoom"><ZoomIn size={19} /></span>
    </button> : <div className="copy-gallery__empty"><ImageIcon size={32} aria-hidden="true" />Фотографии пока не добавлены</div>}
    <p className="copy-gallery__caption">{caption}</p>
    {editing && <label className="copy-gallery__cover-option"><input type="checkbox" checked={useEditionCover} disabled={disabled} onChange={event => onUseEditionCoverChange?.(event.target.checked)} /> Выводить обложку издания игры</label>}
    <PhotoPicker photos={photos} readOnly={!editing} disabled={disabled} sortable selectedIndex={index} onSelect={position => setSelected(photos[position])} onChange={onChange} onBusyChange={onBusyChange} />
    {expanded && displayPhotos.length > 0 && <PhotoLightbox photos={displayPhotos} title={title} initialIndex={index} onClose={() => setExpanded(false)} />}
  </div>;
}
