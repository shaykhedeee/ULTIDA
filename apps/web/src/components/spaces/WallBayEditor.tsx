import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Ruler,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  SplitSquareHorizontal,
  Wand2,
  Sliders,
  Maximize2,
  RotateCw,
  Info,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  type BayV1,
  type CompositionScheduleV1,
} from '@ultida/contracts';
import {
  reconcileBays,
  type ReconciliationResult,
  type Wall,
  type Opening,
  type ModuleInstance,
} from '@ultida/scene-compiler';
import { IndianModularCatalog, type CatalogModule } from '@ultida/catalog-core';
import './wall-bay-editor.css';

export interface WallBayEditorProps {
  wall: {
    id: string;
    lengthMm: number;
    name?: string;
    start?: { xMm: number; yMm: number };
    end?: { xMm: number; yMm: number };
  };
  openings?: Array<{
    id: string;
    wallId?: string;
    kind: string;
    offsetAlongWallMm: number;
    widthMm?: number;
  }>;
  leftClearanceMm?: number;
  rightClearanceMm?: number;
  initialSchedule?: CompositionScheduleV1 | null;
  onScheduleChange?: (schedule: CompositionScheduleV1, reconciliation: ReconciliationResult) => void;
  onConfirmSchedule?: (schedule: CompositionScheduleV1) => void;
}

function formatMm(val: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(Number(val.toFixed(1)));
}

export const WallBayEditor: React.FC<WallBayEditorProps> = ({
  wall,
  openings = [],
  leftClearanceMm = 50,
  rightClearanceMm = 50,
  initialSchedule,
  onScheduleChange,
  onConfirmSchedule,
}) => {
  const wallLengthMm = wall.lengthMm || 3000;
  const approvedUsableWidthMm = Math.max(100, wallLengthMm - leftClearanceMm - rightClearanceMm);

  // Filter openings on this wall and convert to keep-out segments
  const wallOpenings: Opening[] = useMemo(() => {
    return openings
      .filter((o) => !o.wallId || o.wallId === wall.id)
      .map((o) => ({
        id: o.id,
        wallId: wall.id,
        kind: (o.kind === 'window' ? 'window' : o.kind === 'passage' ? 'passage' : 'door'),
        offsetMm: Math.max(0, o.offsetAlongWallMm - leftClearanceMm),
        widthMm: o.widthMm || 900,
      }));
  }, [openings, wall.id, leftClearanceMm]);

  // Generate initial bays if no schedule provided
  const generateDefaultBays = useCallback((): BayV1[] => {
    const list: BayV1[] = [];
    // If there are keep-out openings, interleave them
    const sortedOpenings = [...wallOpenings].sort((a, b) => a.offsetMm - b.offsetMm);
    let cursor = 0;

    sortedOpenings.forEach((op, idx) => {
      if (op.offsetMm > cursor) {
        const gap = op.offsetMm - cursor;
        // Divide gap into 600 or 900 bays + filler
        let remaining = gap;
        let subIndex = 1;
        while (remaining >= 600) {
          const w = remaining >= 900 && remaining % 900 === 0 ? 900 : 600;
          list.push({
            id: `bay-${list.length + 1}`,
            offsetMm: cursor + (gap - remaining),
            widthMm: w,
            keepOut: false,
          });
          remaining -= w;
          subIndex++;
        }
        if (remaining > 0) {
          list.push({
            id: `filler-${list.length + 1}`,
            offsetMm: cursor + (gap - remaining),
            widthMm: remaining,
            keepOut: false,
          });
        }
      }
      // Add keep out bay
      list.push({
        id: `keep-out-${op.id || idx + 1}`,
        offsetMm: op.offsetMm,
        widthMm: op.widthMm,
        keepOut: true,
      });
      cursor = op.offsetMm + op.widthMm;
    });

    if (cursor < approvedUsableWidthMm) {
      let remaining = approvedUsableWidthMm - cursor;
      while (remaining >= 600) {
        const w = remaining >= 900 ? 900 : 600;
        list.push({
          id: `bay-${list.length + 1}`,
          offsetMm: cursor,
          widthMm: w,
          keepOut: false,
        });
        cursor += w;
        remaining -= w;
      }
      if (remaining > 0) {
        list.push({
          id: `filler-${list.length + 1}`,
          offsetMm: cursor,
          widthMm: remaining,
          keepOut: false,
        });
      }
    }

    // If empty wall with no openings, create standard layout
    if (list.length === 0) {
      const standardBay = 600;
      let pos = 0;
      let count = 1;
      while (pos + standardBay <= approvedUsableWidthMm) {
        list.push({
          id: `bay-${count}`,
          offsetMm: pos,
          widthMm: standardBay,
          keepOut: false,
        });
        pos += standardBay;
        count++;
      }
      if (pos < approvedUsableWidthMm) {
        const rem = approvedUsableWidthMm - pos;
        list.push({
          id: `filler-${count}`,
          offsetMm: pos,
          widthMm: rem,
          keepOut: false,
        });
      }
    }

    return list;
  }, [wallOpenings, approvedUsableWidthMm]);

  const [bays, setBays] = useState<BayV1[]>(() => {
    if (initialSchedule && initialSchedule.bays.length > 0) {
      return initialSchedule.bays;
    }
    return generateDefaultBays();
  });

  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(initialSchedule?.confirmed ?? false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ startX: number; leftWidth: number; rightWidth?: number }>({ startX: 0, leftWidth: 0 });

  // Recalculate offsets sequentially
  const recomputeOffsets = (rawBays: BayV1[]): BayV1[] => {
    let offset = 0;
    return rawBays.map((b) => {
      const updated = { ...b, offsetMm: offset };
      offset += b.widthMm + (b.fillerMm && !b.widthMm ? b.fillerMm : 0);
      return updated;
    });
  };

  // Reconcile schedule with pure scene-compiler engine
  const { schedule, reconciliation } = useMemo(() => {
    const activeBays = recomputeOffsets(bays);
    const sched: CompositionScheduleV1 = {
      wallId: wall.id,
      approvedUsableWidthMm,
      leftClearanceMm,
      rightClearanceMm,
      bays: activeBays,
      confirmed: isConfirmed,
      confirmedBy: isConfirmed ? 'Designer' : undefined,
      confirmedAt: isConfirmed ? new Date().toISOString() : undefined,
    };

    const wallObj: Wall = {
      id: wall.id,
      start: wall.start || { xMm: 0, yMm: 0 },
      end: wall.end || { xMm: wallLengthMm, yMm: 0 },
    };

    const dummyModules: ModuleInstance[] = activeBays
      .filter((b) => b.moduleId && !b.keepOut)
      .map((b) => ({
        id: b.moduleId!,
        widthMm: b.widthMm,
        position: { xMm: b.offsetMm, yMm: 0, zMm: 0 },
      }));

    const result = reconcileBays(sched, wallObj, wallOpenings, dummyModules);
    return { schedule: sched, reconciliation: result };
  }, [bays, wall.id, wall.start, wall.end, wallLengthMm, approvedUsableWidthMm, leftClearanceMm, rightClearanceMm, isConfirmed, wallOpenings]);

  // Notify parent of schedule or reconciliation changes
  useEffect(() => {
    onScheduleChange?.(schedule, reconciliation);
  }, [schedule, reconciliation, onScheduleChange]);

  // Drag-to-resize boundary handler
  const handleMouseDownDivider = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const leftBay = bays[index];
    const rightBay = bays[index + 1];
    if (!leftBay || leftBay.keepOut) return;

    dragStartRef.current = {
      startX: e.clientX,
      leftWidth: leftBay.widthMm,
      rightWidth: rightBay ? rightBay.widthMm : undefined,
    };
    setDraggingIndex(index);
  };

  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const trackWidthPx = trackRef.current.clientWidth || 600;
      const mmPerPx = approvedUsableWidthMm / trackWidthPx;
      const deltaPx = e.clientX - dragStartRef.current.startX;
      const deltaMm = Math.round((deltaPx * mmPerPx) / 10) * 10; // Snap to 10mm

      setBays((prev) => {
        const next = [...prev];
        const left = next[draggingIndex];
        const right = next[draggingIndex + 1];
        if (!left) return prev;

        const newLeftWidth = Math.max(100, dragStartRef.current.leftWidth + deltaMm);
        if (right && !right.keepOut && dragStartRef.current.rightWidth !== undefined) {
          const newRightWidth = Math.max(100, dragStartRef.current.rightWidth - deltaMm);
          if (newLeftWidth >= 100 && newRightWidth >= 100) {
            next[draggingIndex] = { ...left, widthMm: newLeftWidth };
            next[draggingIndex + 1] = { ...right, widthMm: newRightWidth };
          }
        } else {
          // Free adjust of left bay
          next[draggingIndex] = { ...left, widthMm: newLeftWidth };
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      setDraggingIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIndex, approvedUsableWidthMm]);

  // Quick Bay Actions
  const handleUpdateWidth = (bayId: string, newWidthMm: number) => {
    const clamped = Math.max(50, Math.round(newWidthMm));
    setBays((prev) =>
      prev.map((b) => (b.id === bayId && !b.keepOut ? { ...b, widthMm: clamped, fillerMm: b.fillerMm ? clamped : undefined } : b))
    );
  };

  const handleAdjustStep = (bayId: string, delta: number) => {
    setBays((prev) =>
      prev.map((b) => {
        if (b.id === bayId && !b.keepOut) {
          const w = Math.max(50, b.widthMm + delta);
          return { ...b, widthMm: w, fillerMm: b.fillerMm ? w : undefined };
        }
        return b;
      })
    );
  };

  const handleSplitBay = (bayId: string) => {
    setBays((prev) => {
      const idx = prev.findIndex((b) => b.id === bayId);
      if (idx === -1) return prev;
      const target = prev[idx];
      if (target.keepOut || target.widthMm < 300) return prev;

      const halfA = Math.round(target.widthMm / 2 / 10) * 10;
      const halfB = target.widthMm - halfA;
      const newBayA: BayV1 = { ...target, widthMm: halfA, fillerMm: undefined };
      const newBayB: BayV1 = {
        id: `bay-${Date.now() % 10000}`,
        offsetMm: target.offsetMm + halfA,
        widthMm: halfB,
        keepOut: false,
      };
      const copy = [...prev];
      copy.splice(idx, 1, newBayA, newBayB);
      return copy;
    });
  };

  const handleDeleteBay = (bayId: string) => {
    setBays((prev) => prev.filter((b) => b.id !== bayId || b.keepOut));
    if (selectedBayId === bayId) setSelectedBayId(null);
  };

  const handleToggleFiller = (bayId: string) => {
    setBays((prev) =>
      prev.map((b) => {
        if (b.id === bayId && !b.keepOut) {
          const isFiller = Boolean(b.fillerMm);
          return {
            ...b,
            fillerMm: isFiller ? undefined : b.widthMm,
            moduleId: isFiller ? b.moduleId : undefined,
          };
        }
        return b;
      })
    );
  };

  // 1-Click Auto-Resolve Quick Fixes
  const handleAutoResolveWithEndFiller = () => {
    const delta = reconciliation.deltaMm;
    if (Math.abs(delta) < 0.5) return;

    setBays((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && !last.keepOut && (last.fillerMm || last.id.startsWith('filler'))) {
        // Adjust existing filler
        const newW = last.widthMm + delta;
        if (newW > 0) {
          copy[copy.length - 1] = { ...last, widthMm: Math.round(newW * 10) / 10, fillerMm: undefined };
          return copy;
        }
      }
      if (delta > 0) {
        // Add new end filler
        copy.push({
          id: `filler-${copy.length + 1}`,
          offsetMm: approvedUsableWidthMm - delta,
          widthMm: Math.round(delta * 10) / 10,
          keepOut: false,
        });
      } else {
        // Negative delta: shrink last non-keepout bay
        for (let i = copy.length - 1; i >= 0; i--) {
          if (!copy[i].keepOut && copy[i].widthMm > Math.abs(delta) + 50) {
            copy[i] = { ...copy[i], widthMm: copy[i].widthMm + delta };
            break;
          }
        }
      }
      return copy;
    });
  };

  const handleDistributeGapAcrossBays = () => {
    const delta = reconciliation.deltaMm;
    if (Math.abs(delta) < 0.5) return;

    setBays((prev) => {
      const editableBays = prev.filter((b) => !b.keepOut && !b.fillerMm);
      if (editableBays.length === 0) return prev;
      const share = delta / editableBays.length;
      return prev.map((b) => {
        if (!b.keepOut && !b.fillerMm) {
          const w = Math.max(100, Math.round(b.widthMm + share));
          return { ...b, widthMm: w };
        }
        return b;
      });
    });
  };

  const handleResetToStandardGrid = () => {
    setBays(generateDefaultBays());
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    onConfirmSchedule?.({ ...schedule, confirmed: true, confirmedBy: 'Designer', confirmedAt: new Date().toISOString() });
  };

  const isExactMatch = Math.abs(reconciliation.deltaMm) <= 0.5;
  const mismatchBlocker = reconciliation.issues.find((i) => i.code === 'BAY_TOTAL_MISMATCH');

  return (
    <div className="wall-bay-editor-container" data-testid="wall-bay-editor">
      {/* Header Bar */}
      <div className="wbe-header">
        <div className="wbe-header-info">
          <div className="wbe-wall-tag">
            <Ruler size={15} />
            <span>{wall.name || `Wall ${wall.id}`}</span>
          </div>
          <span className="wbe-stat-dim">Measured: <strong>{formatMm(wallLengthMm)} mm</strong></span>
          <span className="wbe-stat-sep">·</span>
          <span className="wbe-stat-dim">Usable: <strong>{formatMm(approvedUsableWidthMm)} mm</strong></span>
          <span className="wbe-stat-sep">·</span>
          <span className="wbe-clearance-pill">
            Clearances: L {leftClearanceMm}mm / R {rightClearanceMm}mm
          </span>
        </div>

        <div className="wbe-header-actions">
          <button
            type="button"
            className="wbe-action-btn secondary"
            onClick={handleResetToStandardGrid}
            title="Reset bays to standard 600/900mm System 32 grid"
          >
            <RotateCw size={13} /> Reset Standard
          </button>
          <button
            type="button"
            className={`wbe-action-btn ${isExactMatch ? 'primary' : 'disabled'}`}
            disabled={!isExactMatch}
            onClick={handleConfirm}
            title={isExactMatch ? 'Confirm this bay composition schedule for scene compilation' : 'Reconcile bay width to approved usable wall before confirming'}
          >
            <CheckCircle2 size={13} /> {isConfirmed ? '✓ Confirmed Schedule' : 'Confirm Bay Schedule'}
          </button>
        </div>
      </div>

      {/* Live Reconciliation State Bar */}
      <div className={`wbe-reconciliation-bar ${isExactMatch ? 'reconciled' : 'mismatch'}`}>
        <div className="wbe-recon-stat">
          <span className="label">Live Bay Total</span>
          <strong className="value">{formatMm(reconciliation.bayTotalMm)} mm</strong>
        </div>
        <div className="wbe-recon-operator">/</div>
        <div className="wbe-recon-stat">
          <span className="label">Approved Usable Wall</span>
          <strong className="value">{formatMm(approvedUsableWidthMm)} mm</strong>
        </div>
        <div className="wbe-recon-operator">=</div>
        <div className="wbe-recon-stat">
          <span className="label">Delta / Gap</span>
          <strong className={`value ${isExactMatch ? 'exact' : 'mismatch'}`}>
            {isExactMatch ? '0.0 mm (Exact Match)' : `${formatMm(Math.abs(reconciliation.deltaMm))} mm ${reconciliation.deltaMm > 0 ? 'gap' : 'overflow'}`}
          </strong>
        </div>

        <div className="wbe-recon-badge">
          {isExactMatch ? (
            <span className="badge-pass">
              <CheckCircle2 size={14} /> Reconciled — Exact Fit
            </span>
          ) : (
            <span className="badge-mismatch">
              <AlertTriangle size={14} /> Mismatch Detected
            </span>
          )}
        </div>
      </div>

      {/* Persistent Inline Blocker Message (Matches scene-compiler format exactly) */}
      {!isExactMatch && mismatchBlocker && (
        <div className="wbe-blocker-banner" role="alert">
          <div className="wbe-blocker-content">
            <AlertTriangle size={18} className="wbe-blocker-icon" />
            <div>
              <strong>Reconciliation Gate Blocked</strong>
              <p className="wbe-blocker-text">{mismatchBlocker.message}</p>
            </div>
          </div>
          <div className="wbe-quick-resolutions">
            <button
              type="button"
              className="btn-quick-fix"
              onClick={handleAutoResolveWithEndFiller}
              title="Add or resize end filler to reconcile the exact gap"
            >
              <Wand2 size={13} /> ⚡ Auto-Resolve with End Filler
            </button>
            <button
              type="button"
              className="btn-quick-fix outline"
              onClick={handleDistributeGapAcrossBays}
              title="Evenly distribute the difference across all modular bays"
            >
              <Sliders size={13} /> ⚡ Distribute Across Bays
            </button>
          </div>
        </div>
      )}

      {/* Interactive Visual Rail (Usable Wall Track) */}
      <div className="wbe-rail-container">
        {/* Left Clearance Indicator */}
        <div
          className="wbe-clearance-indicator left"
          title={`Left Wall Clearance: ${leftClearanceMm}mm`}
          style={{ width: `${Math.max(20, (leftClearanceMm / wallLengthMm) * 100)}%` }}
        >
          <span>L {leftClearanceMm}mm</span>
        </div>

        {/* Usable Rail with Bays */}
        <div className="wbe-track" ref={trackRef}>
          {bays.map((bay, idx) => {
            const widthPct = (bay.widthMm / approvedUsableWidthMm) * 100;
            const isSelected = selectedBayId === bay.id;
            const isLast = idx === bays.length - 1;

            return (
              <React.Fragment key={bay.id}>
                <div
                  className={`wbe-bay-segment ${bay.keepOut ? 'keep-out' : bay.fillerMm ? 'filler' : 'modular'} ${isSelected ? 'selected' : ''}`}
                  style={{ width: `${widthPct}%` }}
                  onClick={() => setSelectedBayId(bay.id)}
                  title={`${bay.keepOut ? 'Keep-Out (Door/Window)' : bay.fillerMm ? 'Filler / System 32 Dummy Filler' : 'Modular Cabinet Bay'} · ${bay.widthMm}mm`}
                >
                  <div className="wbe-bay-top-indicator">
                    {bay.keepOut ? (
                      <Lock size={12} className="text-red" />
                    ) : bay.fillerMm ? (
                      <span className="filler-tag">Filler</span>
                    ) : (
                      <span className="modular-tag">Bay {idx + 1}</span>
                    )}
                  </div>
                  <div className="wbe-bay-width-label">
                    <strong>{Math.round(bay.widthMm)}</strong>
                    <small>mm</small>
                  </div>
                  {bay.moduleId && <div className="wbe-bay-module-sku">{bay.moduleId}</div>}
                </div>

                {/* Drag Handle Divider between bays (disabled if keepOut) */}
                {!isLast && (
                  <div
                    className={`wbe-divider-handle ${bay.keepOut ? 'disabled' : ''} ${draggingIndex === idx ? 'active-dragging' : ''}`}
                    onMouseDown={(e) => handleMouseDownDivider(idx, e)}
                    title={bay.keepOut ? 'Cannot drag into keep-out zone' : 'Drag to resize bay boundary'}
                  >
                    <div className="handle-line" />
                    <div className="handle-dot" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Right Clearance Indicator */}
        <div
          className="wbe-clearance-indicator right"
          title={`Right Wall Clearance: ${rightClearanceMm}mm`}
          style={{ width: `${Math.max(20, (rightClearanceMm / wallLengthMm) * 100)}%` }}
        >
          <span>R {rightClearanceMm}mm</span>
        </div>
      </div>

      {/* Bay Item Detail / Inspector Drawer */}
      <div className="wbe-inspector-panel">
        <div className="wbe-inspector-header">
          <h4>Configured Bays ({bays.length})</h4>
          <span className="wbe-hint">Click a bay or drag dividers to resize. Usable wall: {approvedUsableWidthMm}mm</span>
        </div>

        <div className="wbe-bay-list">
          {bays.map((bay, idx) => {
            const isSel = selectedBayId === bay.id;
            return (
              <div
                key={bay.id}
                className={`wbe-bay-card ${bay.keepOut ? 'is-keepout' : bay.fillerMm ? 'is-filler' : 'is-modular'} ${isSel ? 'active-card' : ''}`}
                onClick={() => setSelectedBayId(bay.id)}
              >
                <div className="wbc-col-info">
                  <div className="wbc-title-row">
                    {bay.keepOut ? (
                      <span className="wbc-badge keep-out"><Lock size={11} /> Keep-Out</span>
                    ) : bay.fillerMm ? (
                      <span className="wbc-badge filler">Filler</span>
                    ) : (
                      <span className="wbc-badge modular">Bay {idx + 1}</span>
                    )}
                    <span className="wbc-offset">Offset: {Math.round(bay.offsetMm)} mm</span>
                  </div>
                  <div className="wbc-name">
                    {bay.keepOut ? 'Door / Window Clearance' : bay.fillerMm ? 'System 32 Dummy Filler' : bay.moduleId || 'Modular Cabinet'}
                  </div>
                </div>

                {/* Dimension & Action Controls */}
                <div className="wbc-col-controls">
                  {!bay.keepOut ? (
                    <>
                      <div className="wbc-stepper">
                        <button type="button" className="btn-step" onClick={() => handleAdjustStep(bay.id, -50)} title="Reduce 50mm">-50</button>
                        <input
                          type="number"
                          className="wbc-width-input"
                          value={Math.round(bay.widthMm)}
                          onChange={(e) => handleUpdateWidth(bay.id, Number(e.target.value))}
                          step={10}
                          min={50}
                        />
                        <span className="wbc-unit">mm</span>
                        <button type="button" className="btn-step" onClick={() => handleAdjustStep(bay.id, 50)} title="Add 50mm">+50</button>
                      </div>

                      <div className="wbc-actions">
                        <button
                          type="button"
                          className="wbc-btn"
                          onClick={() => handleSplitBay(bay.id)}
                          title="Split this bay into two equal bays"
                        >
                          <SplitSquareHorizontal size={13} />
                        </button>
                        <button
                          type="button"
                          className={`wbc-btn ${bay.fillerMm ? 'active' : ''}`}
                          onClick={() => handleToggleFiller(bay.id)}
                          title={bay.fillerMm ? 'Convert back to modular unit' : 'Mark as System 32 filler'}
                        >
                          Fill
                        </button>
                        {bays.filter((b) => !b.keepOut).length > 1 && (
                          <button
                            type="button"
                            className="wbc-btn danger"
                            onClick={() => handleDeleteBay(bay.id)}
                            title="Remove this bay"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="wbc-keepout-lock">
                      <Lock size={13} /> Fixed Opening Range ({bay.widthMm}mm)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WallBayEditor;
