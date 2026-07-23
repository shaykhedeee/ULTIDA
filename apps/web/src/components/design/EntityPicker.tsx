import React from 'react';
import { Layers } from 'lucide-react';

export type SceneEntity = {
  id: string;
  kind: 'wall' | 'opening' | 'module' | 'room' | 'fixture';
  family?: string;
  roomId?: string;
};

type Props = {
  entities: SceneEntity[];
  selectedId?: string | null;
  onSelect: (entityId: string | null) => void;
};

export function EntityPicker({ entities, selectedId, onSelect }: Props) {
  return (
    <div className="entity-picker">
      <div className="entity-picker-heading">
        <Layers size={14} />
        <strong>Scene entities</strong>
      </div>
      <div className="entity-picker-list">
        {entities.map((entity) => (
          <button
            key={entity.id}
            type="button"
            onClick={() => onSelect(selectedId === entity.id ? null : entity.id)}
            className={`entity-picker-row${selectedId === entity.id ? ' active' : ''}`}
          >
            <span className="entity-id">{entity.id}</span>
            <span className="entity-kind">{entity.kind}</span>
            <span className="entity-meta">{entity.family ?? entity.roomId ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default EntityPicker;
