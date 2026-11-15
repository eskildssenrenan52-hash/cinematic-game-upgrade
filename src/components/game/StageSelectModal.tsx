// @ts-nocheck — imported game code, typed under the original looser tsconfig
import React from 'react';
import { ChapterDef, HudSnapshot, PlayModeId } from '../../game/types';
import { BIOME_META } from '../../game/worldData';
import { PixelButton, PixelIcon, PixelWindow } from './PixelUi';

interface StageSelectModalProps {
  hud: HudSnapshot;
  playMode?: PlayModeId;
  chapters: ChapterDef[];
  collectedRelics: Set<string>;
  onSelectChapter: (chapterIdx: number) => void;
  onFastTravelStage: (stageId: string) => void;
  onClose: () => void;
}

function formatBest(sec: number | null): string {
  if (sec === null) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const StageSelectModal: React.FC<StageSelectModalProps> = ({
  hud,
  playMode = 'campaign',
  chapters,
  collectedRelics,
  onSelectChapter,
  onFastTravelStage,
  onClose,
}) => {
  const unlockAllModes = playMode === 'speedrun' || playMode === 'mirror_void';
  const visitedSet = new Set(hud.visitedStages);
  const shrineSet = new Set(hud.unlockedShrines);
  const activeChapter = chapters[hud.chapterIndex] ?? chapters[0];

  const maxGx = Math.max(...activeChapter.stages.map((s) => s.gx), 0);
  const maxGy = Math.max(...activeChapter.stages.map((s) => s.gy), 0);
  const stageCoordMap = new Map(activeChapter.stages.map((s) => [`${s.gx},${s.gy}`, s]));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seleção de Fases e Etapas"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#05040a]/90 p-4 pointer-events-auto"
    >
      <PixelWindow
        title="Seleção de Fases"
        subtitle={`${chapters.length} Capítulos com múltiplas etapas interligadas · Conclua cada fase para desbloquear a próxima`}
        accentColor="#ffd27d"
        onClose={onClose}
        closeLabel="Fechar seleção de fases"
        maxWidthClass="max-w-5xl"
      >
        <div className="max-h-[72vh] overflow-y-auto pr-1 pixel-scroll">
          {/* 6 Chapters Pixel Grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {chapters.map((ch) => {
              const rec = hud.chapterRecords[ch.index] ?? {
                unlocked: ch.index === 0,
                cleared: false,
                bestTimeSeconds: null,
                fewestDeaths: null,
              };
              const isUnlocked = rec.unlocked || unlockAllModes;
              const meta = BIOME_META[ch.id];
              const isCurrent = hud.chapterIndex === ch.index;
              const relicsHere = ch.stages.reduce(
                (acc, st) =>
                  acc +
                  st.entities.filter(
                    (e) =>
                      (e.kind === 'relic' || e.kind === 'winged_relic') &&
                      collectedRelics.has(e.id)
                  ).length,
                0
              );

              return (
                <div
                  key={ch.id}
                  style={{
                    borderColor: isCurrent ? '#ffd27d' : '#07050d',
                  }}
                  className="pixel-subpanel flex flex-col justify-between p-3"
                >
                  <div>
                    {/* Biome Color Strip */}
                    <div
                      style={{
                        backgroundColor: meta.skyMid,
                        borderBottom: `3px solid ${ch.accent}`,
                      }}
                      className="mb-2.5 flex items-center justify-between px-2.5 py-2 border-2 border-[#07050d]"
                    >
                      <span className="font-pixel text-xs font-bold" style={{ color: ch.accent }}>
                        CAPÍTULO {ch.index + 1}
                      </span>
                      <span className="flex items-center gap-1 font-pixel text-xs">
                        {rec.cleared ? (
                          <span className="flex items-center gap-1 text-[#4df0c0]">
                            <PixelIcon name="check" className="h-3.5 w-3.5" />
                            Concluída
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-[#ffd27d]">Disponível</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#7b7094]">
                            <PixelIcon name="lock" className="h-3.5 w-3.5" />
                            Bloqueada
                          </span>
                        )}
                      </span>
                    </div>

                    <h3 className="font-pixel text-base font-bold text-[#f5efe6]">
                      {ch.name.replace(/^Fase \d+ · /, '')}
                    </h3>
                    <p className="font-body-pixel text-[11px] text-[#a9a0bd]">{ch.subtitle}</p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-num text-[11px] text-[#d6cde8]">
                      <span>{ch.stages.length} Etapas</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Relíquias {relicsHere}/{ch.totalRelics}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Recorde {formatBest(rec.bestTimeSeconds)}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <PixelButton
                      type="button"
                      variant={isCurrent ? 'gold' : isUnlocked ? 'cyan' : 'slate'}
                      disabled={!isUnlocked}
                      onClick={() => onSelectChapter(ch.index)}
                      className="w-full py-1.5 text-sm"
                    >
                      {!isUnlocked ? (
                        <>
                          <PixelIcon name="lock" className="h-3.5 w-3.5" />
                          <span>Conclua a Fase {ch.index}</span>
                        </>
                      ) : isCurrent ? (
                        <>
                          <PixelIcon name="play" className="h-3.5 w-3.5" />
                          <span>Reiniciar Fase {ch.index + 1}</span>
                        </>
                      ) : (
                        <>
                          <PixelIcon name="play" className="h-3.5 w-3.5" />
                          <span>Jogar Fase {ch.index + 1}</span>
                        </>
                      )}
                    </PixelButton>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Chapter Stage Mini-Map */}
          <div className="pixel-subpanel mt-4 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-[#07050d]">
              <div>
                <h3 className="font-pixel text-base font-bold text-[#e8a87c]">
                  Mapa Interno · {activeChapter.name}
                </h3>
                <p className="font-body-pixel text-[11px] text-[#a9a0bd]">
                  Etapas conectadas desta fase · Clique em uma Fogueira acesa para viajar
                </p>
              </div>
              <span className="font-mono-num text-xs text-[#ffd27d]">
                Etapa {hud.stageNumber}/{hud.totalStagesInChapter} · {hud.roomName}
              </span>
            </div>

            <div
              style={{ gridTemplateColumns: `repeat(${maxGx + 1}, minmax(0, 1fr))` }}
              className="mt-3 grid gap-1.5"
            >
              {Array.from({ length: maxGy + 1 }).map((_, gy) =>
                Array.from({ length: maxGx + 1 }).map((__, gx) => {
                  const st = stageCoordMap.get(`${gx},${gy}`);
                  if (!st) {
                    return <div key={`empty_${gx}_${gy}`} className="h-11 bg-[#0b0814]/40 border border-[#1d172e]" />;
                  }
                  const visited = visitedSet.has(st.id);
                  const isCurrent = hud.currentRoomId === st.id;
                  const hasShrine = shrineSet.has(st.id);

                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={!hasShrine}
                      onClick={() => hasShrine && onFastTravelStage(st.id)}
                      title={visited ? st.name : `Etapa ${st.stageIndex + 1} (não visitada)`}
                      aria-label={visited ? `${st.name}${hasShrine ? ' - Viajar para fogueira' : ''}` : `Etapa ${st.stageIndex + 1}`}
                      style={{
                        backgroundColor: isCurrent
                          ? '#3d2f1e'
                          : visited
                            ? BIOME_META[activeChapter.id].mountainNear
                            : '#120e1c',
                        borderColor: isCurrent ? '#ffd27d' : visited ? activeChapter.accent : '#2a223d',
                      }}
                      className={`flex h-11 items-center justify-center gap-1.5 border-2 px-2 font-pixel text-xs ${
                        hasShrine ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
                      }`}
                    >
                      {isCurrent && <PixelIcon name="pin" className="h-4 w-4" />}
                      {!isCurrent && hasShrine && <PixelIcon name="flame" className="h-4 w-4" />}
                      {!isCurrent && !hasShrine && st.stageIndex === activeChapter.stages.length - 1 && (
                        <PixelIcon name="crown" className="h-3.5 w-3.5" />
                      )}
                      <span className="truncate text-[#f5efe6]">
                        {visited ? `E${st.stageIndex + 1}` : '?'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </PixelWindow>
    </div>
  );
};
