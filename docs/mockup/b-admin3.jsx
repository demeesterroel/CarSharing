// Fleet Economics screens — implements the Fleet Economics Design doc.
//   - AdminFleet        : home tiles (one per car), bucket visualization YTD
//   - BreakEvenDetail   : per-car deep dive (bucket + km curve + narrated breakdown)
//   - NarratedPayout    : replaces the spreadsheet-style AdminPayout
//   - RateAssistant     : January decision flow

// ══════════════════════════════════════════════════════════════════
// ── Shared building blocks
// ══════════════════════════════════════════════════════════════════

// Liquid bucket visualization — a paper card with a filling level.
function BucketCard({ fe, car, lang, onClick, onRaiseRate, compact }) {
  const pct = Math.min(100, fe.recoveredPct);
  const ownerName = fe.ownerIds[0];
  const past = fe.pastBreakEven;
  const status = fe.status || (past ? 'green' : 'red');
  const h = compact ? 80 : 120;

  const badgeConf = {
    green: { color: paperB.green,  nl: 'Break-even', en: 'Break-even' },
    amber: { color: paperB.amber,  nl: 'Bijna',      en: 'Close'      },
    red:   { color: paperB.accent, nl: '⚠ Achter',   en: '⚠ Behind'  },
  }[status] || { color: paperB.inkDim, nl: '—', en: '—' };

  const projectedBurden = fe.projectedBurden || 0;
  const projEndText = projectedBurden > 0
    ? (lang === 'nl'
        ? `Op dit tempo eindigt 2026 op −${fmtMoney(projectedBurden)}`
        : `At this pace, 2026 ends at −${fmtMoney(projectedBurden)}`)
    : (lang === 'nl' ? 'Break-even is haalbaar dit jaar' : 'Break-even is within reach this year');

  const lastYearCoopKm = fe.lastYearCoopKm || 0;
  const yoyDelta = fe.kmOthers - lastYearCoopKm;
  const yoyPct   = lastYearCoopKm > 0 ? Math.round((yoyDelta / lastYearCoopKm) * 100) : 0;
  const currentBurden = fe.vasteTotal - fe.recoveredYTD;

  return (
    <div onClick={!compact && onClick ? undefined : onClick} style={{
      background: paperB.paper,
      padding: compact ? '14px 14px 12px' : '18px 18px 16px',
      cursor: compact && onClick ? 'pointer' : 'default',
      borderTop: `2px solid ${paperB.ink}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.04)',
      marginBottom: 12,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <CarStamp code={car.short} active size={compact ? 'sm' : 'md'}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: compact ? 17 : 20,
            fontWeight: 700, color: paperB.ink, letterSpacing: -0.3, lineHeight: 1.05,
          }}>{car.name}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2,
          }}>{car.merk} · {ownerName}</div>
        </div>
        <Stamp rotate={6} color={badgeConf.color} size="sm">
          {lang === 'nl' ? badgeConf.nl : badgeConf.en}
        </Stamp>
      </div>

      {/* Liquid bucket */}
      <div style={{
        position: 'relative', width: '100%', height: h,
        background: paperB.paperDeep, border: `1.5px solid ${paperB.ink}`, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: pct + '%',
          background: past
            ? `repeating-linear-gradient(45deg, ${paperB.green} 0 6px, ${paperB.paper}44 6px 12px)`
            : `linear-gradient(180deg, ${paperB.blue}aa, ${paperB.blue})`,
          transition: 'height 0.4s ease-out',
        }}/>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 'calc(' + pct + '% - 2px)',
          height: 3, background: past ? paperB.green : paperB.blue, opacity: pct > 0 ? 0.7 : 0,
        }}/>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: compact ? 22 : 30,
            fontWeight: 700, color: paperB.ink, lineHeight: 1, letterSpacing: -0.8,
            textShadow: '0 0 10px ' + paperB.paper + 'cc',
          }}>{fmtMoney(fe.recoveredYTD)}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3,
            textShadow: '0 0 8px ' + paperB.paper + 'cc',
          }}>
            {lang === 'nl' ? 'van' : 'of'} {fmtMoney(fe.vasteTotal)} {lang === 'nl' ? 'gedekt' : 'recovered'}
          </div>
        </div>
      </div>

      {/* Footer km stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 10,
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 1.2, textTransform: 'uppercase',
      }}>
        <div>
          <span style={{ color: paperB.ink, fontWeight: 700 }}>{fe.kmOthers.toLocaleString('nl-BE')}</span>
          {' / '}{fe.breakEvenKm.toLocaleString('nl-BE')} km
        </div>
        <div>
          {past
            ? `+${Math.round(fe.kmOthers - fe.breakEvenKm).toLocaleString('nl-BE')} km`
            : (lang === 'nl'
                ? `nog ${fe.kmUntilBreakEven.toLocaleString('nl-BE')} km`
                : `${fe.kmUntilBreakEven.toLocaleString('nl-BE')} km to go`)}
        </div>
      </div>

      {/* Projected year-end landing */}
      {!compact && (
        <div style={{
          marginTop: 10, fontFamily: paperB.fontSerif, fontSize: 13,
          color: paperB.inkDim, fontStyle: 'italic', lineHeight: 1.35,
        }}>{projEndText}</div>
      )}

      {/* vs. last year compare strip */}
      {!compact && lastYearCoopKm > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5,
            textTransform: 'uppercase', color: paperB.inkDim, fontWeight: 700, marginBottom: 8,
          }}>— {lang === 'nl' ? 'vs. vorig jaar (april)' : 'vs. last year (april)'} —</div>
          <div style={{ background: paperB.paperDeep, padding: '10px 12px', border: `1px dashed ${paperB.paperDark}` }}>
            <ReceiptRow
              label={lang === 'nl' ? 'Co-op km @ apr' : 'Co-op km @ apr'}
              value={`${lastYearCoopKm.toLocaleString('nl-BE')} → ${fe.kmOthers.toLocaleString('nl-BE')} (${yoyDelta >= 0 ? '+' : ''}${yoyPct}%)`}
              color={yoyDelta >= 0 ? paperB.green : paperB.accent}
            />
            <ReceiptRow
              label={lang === 'nl' ? 'Rest vaste kosten' : 'Burden remaining'}
              value={`${fmtMoney(fe.lastYearBurden)} → ${fmtMoney(currentBurden)}`}
              color={currentBurden < fe.lastYearBurden ? paperB.green : paperB.accent}
            />
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 12, color: paperB.inkDim,
              fontStyle: 'italic', lineHeight: 1.4,
              paddingTop: 6, borderTop: `1px dotted ${paperB.paperDark}`, marginTop: 6,
            }}>
              {lang === 'nl'
                ? (yoyDelta > 0
                    ? `${car.name} rijdt beter dan vorig jaar.${fe.projectedBurden > 0 ? ' Maar break-even is nog ver.' : ' Break-even is haalbaar dit jaar.'}`
                    : `${car.name} loopt achter op vorig jaar. Meer co-op ritten nodig.`)
                : (yoyDelta > 0
                    ? `${car.name} is trending better than last year.${fe.projectedBurden > 0 ? ' But break-even is still far off.' : ' Break-even is within reach.'}`
                    : `${car.name} is behind last year's pace. More co-op trips needed.`)}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons — explicit CTA when not in compact/detail view */}
      {!compact && (onClick || onRaiseRate) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {onClick && (
            <button onClick={onClick} style={{
              flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
              background: paperB.ink, color: paperB.paper,
              fontFamily: paperB.fontMono, fontSize: 10,
              letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700,
            }}>
              {lang === 'nl' ? 'Zie detail' : 'See detail'}
            </button>
          )}
          {onRaiseRate && (
            <button onClick={onRaiseRate} style={{
              flex: 1, padding: '10px 8px', cursor: 'pointer',
              background: 'transparent', color: paperB.ink,
              border: `1.5px solid ${paperB.ink}`,
              fontFamily: paperB.fontMono, fontSize: 10,
              letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700,
            }}>
              {lang === 'nl' ? 'Verhoog tarief' : 'Raise rate'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── AdminFleet — home screen for admin/owner
// ══════════════════════════════════════════════════════════════════
function AdminFleet({ lang, onOpenCar, onRaiseRate }) {
  const t = strings[lang];
  const { me, role } = useRole();

  // Owner sees only their own cars; admin sees all
  const visibleCars = role === 'owner'
    ? CARS.filter(c => (c.ownerIds || [c.eigenaar]).includes(me))
    : CARS;

  const totalRecovered = visibleCars.reduce((s, c) => s + fleetEconomics(c).recoveredYTD, 0);
  const totalFixed = visibleCars.reduce((s, c) => s + fleetEconomics(c).vasteTotal, 0);
  const totalKmOthers = visibleCars.reduce((s, c) => s + fleetEconomics(c).kmOthers, 0);

  return (
    <div>
      {/* Summary card */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: paperB.ink, color: paperB.paper,
          padding: '16px 18px',
          fontFamily: paperB.fontMono,
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: paperB.paperDark, marginBottom: 6,
          }}>
            {role === 'owner'
              ? (lang === 'nl' ? 'Jouw vloot · 2026 · YTD' : 'Your fleet · 2026 · YTD')
              : (lang === 'nl' ? 'De vloot · 2026 · YTD' : 'The fleet · 2026 · YTD')}
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
              letterSpacing: -0.8, lineHeight: 1,
            }}>{fmtMoney(totalRecovered)}</div>
            <div style={{
              fontSize: 11, color: paperB.paperDark, letterSpacing: 1,
            }}>
              {lang === 'nl'
                ? `van ${fmtMoney(totalFixed)} vaste kosten gedekt door anderen`
                : `of ${fmtMoney(totalFixed)} fixed costs covered by others`}
            </div>
          </div>
          <div style={{
            fontSize: 10, color: paperB.paperDark, letterSpacing: 1.2,
            marginTop: 8, textTransform: 'uppercase',
          }}>
            {totalKmOthers.toLocaleString('nl-BE')} km · {lang === 'nl' ? 'door co-op leden gereden' : 'driven by co-op members'}
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div style={{ padding: '16px 16px 0' }}>
        {visibleCars.map(c => {
          const fe = fleetEconomics(c);
          return <BucketCard key={c.short} car={c} fe={fe} lang={lang}
                    onClick={() => onOpenCar(c.short)}
                    onRaiseRate={onRaiseRate}/>;
        })}
      </div>

      {/* Legend */}
      <div style={{
        padding: '10px 22px 0', fontFamily: paperB.fontMono, fontSize: 9,
        color: paperB.inkMute, letterSpacing: 1, lineHeight: 1.5,
      }}>
        <div>■ {lang === 'nl' ? 'blauw = vaste kosten worden afbetaald' : 'blue = fixed costs being recovered'}</div>
        <div>▦ {lang === 'nl' ? 'groen-gehasht = break-even bereikt, overschot gaat naar eigenaar' : 'green-hatched = break-even reached, surplus goes to owner'}</div>
      </div>
    </div>
  );
}

// ── Break-even curve chart (SVG)
function BreakEvenCurve({ fe, car, lang }) {
  const { curveData, vasteTotal, currentMonth } = fe;
  const MONTHS_ABR = lang === 'nl'
    ? ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Chart dimensions (SVG coordinates)
  const L = 8, R = 302, T = 18, B = 138; // chart area bounds
  const xOf = m  => L + (m - 1) / 11 * (R - L);
  // y: T = full burden (vasteTotal), B = 0 (break-even)
  const yOf = rem => T + (1 - Math.max(0, rem) / vasteTotal) * (B - T);

  const actual = curveData.filter(d => d.actual);
  const proj   = curveData.filter(d => !d.actual);
  const last   = actual[actual.length - 1];

  const actualPts = actual.map(d => `${xOf(d.m)},${yOf(d.remaining)}`).join(' ');
  const projPts   = [
    last && `${xOf(last.m)},${yOf(last.remaining)}`,
    ...proj.map(d => `${xOf(d.m)},${yOf(d.remaining)}`),
  ].filter(Boolean).join(' ');

  // Repair markers: top 3 expenses by amount for this car in the data period
  const repairs = (fe.agg.exp || []).slice().sort((a, b) => b.bedrag - a.bedrag).slice(0, 3);

  return (
    <div style={{
      background: paperB.paper, marginBottom: 12,
      border: `1.5px solid ${paperB.ink}`,
    }}>
      <div style={{
        padding: '12px 14px 4px',
        fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
        textTransform: 'uppercase', color: paperB.inkDim, fontWeight: 700,
      }}>
        {lang === 'nl' ? 'Weg naar break-even · 2026' : 'Road to break-even · 2026'}
      </div>
      <svg viewBox="0 0 310 162" style={{ width: '100%', display: 'block' }}>
        {/* Grid lines */}
        <line x1={L} y1={T} x2={L} y2={B} stroke={paperB.paperDark} strokeWidth="1"/>
        <line x1={L} y1={B} x2={R} y2={B} stroke={paperB.paperDark} strokeWidth="1"/>

        {/* Full burden reference (top) */}
        <line x1={L} y1={T} x2={R} y2={T} stroke={paperB.blue} strokeWidth="0.8" strokeDasharray="3 3"/>
        <text x={L + 2} y={T - 4} fontFamily="'Courier Prime',monospace" fontSize="7"
          fill={paperB.blue} fontWeight="700">
          {fmtMoney(vasteTotal)} {lang === 'nl' ? 'vaste kosten' : 'fixed costs'}
        </text>

        {/* Break-even line label */}
        <text x={R - 2} y={B - 3} textAnchor="end" fontFamily="'Courier Prime',monospace"
          fontSize="7" fill={paperB.green} fontWeight="700">break-even</text>

        {/* Current month marker */}
        {last && (
          <line x1={xOf(currentMonth)} y1={T} x2={xOf(currentMonth)} y2={B + 4}
            stroke={paperB.inkMute} strokeWidth="0.8" strokeDasharray="2 3"/>
        )}

        {/* Actual data */}
        {actualPts && (
          <polyline points={actualPts} fill="none"
            stroke={paperB.accent} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        )}

        {/* Projection */}
        {projPts && (
          <polyline points={projPts} fill="none"
            stroke={paperB.accent} strokeWidth="1.5"
            strokeDasharray="4 3" strokeLinecap="round"/>
        )}

        {/* Current position dot */}
        {last && (
          <circle cx={xOf(last.m)} cy={yOf(last.remaining)} r="4" fill={paperB.accent}/>
        )}

        {/* Repair markers */}
        {repairs.map((exp, i) => {
          const m = parseInt(exp.date.split('-')[1]);
          if (m > currentMonth) return null;
          const cd = curveData.find(d => d.m === m);
          if (!cd) return null;
          const ex = xOf(m), ey = yOf(cd.remaining);
          return (
            <g key={i}>
              <line x1={ex} y1={ey - 9} x2={ex} y2={ey + 9}
                stroke={paperB.amber} strokeWidth="1.5"/>
              <circle cx={ex} cy={ey} r="3.5" fill={paperB.amber}
                stroke={paperB.paper} strokeWidth="1.2"/>
            </g>
          );
        })}

        {/* Month labels */}
        {[1, 3, 5, 7, 9, 11, 12].map(m => (
          <text key={m} x={xOf(m)} y={B + 14} textAnchor="middle"
            fontFamily="'Courier Prime',monospace" fontSize="7"
            fill={m === currentMonth ? paperB.ink : paperB.inkMute}
            fontWeight={m === currentMonth ? '700' : '400'}>
            {MONTHS_ABR[m - 1]}
          </text>
        ))}
      </svg>

      {/* Legend */}
      {repairs.length > 0 && (
        <div style={{
          padding: '4px 14px 10px',
          fontFamily: paperB.fontMono, fontSize: 8, color: paperB.inkDim, letterSpacing: 1,
        }}>
          <span style={{ color: paperB.amber }}>◆</span>
          {' '}{lang === 'nl' ? 'reparatiemarker' : 'repair marker'}
          {repairs.map((e, i) => (
            <span key={i} style={{ marginLeft: 8, color: paperB.inkMute }}>
              · {e.kosten}: {fmtMoney(e.bedrag)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contribution ledger: who drove how much, sorted by km desc
function ContributionLedger({ fe, lang }) {
  const { contributions } = fe;
  if (!contributions || contributions.length === 0) {
    return (
      <div style={{
        background: paperB.paper, padding: '16px 18px',
        borderTop: `2px solid ${paperB.ink}`, marginBottom: 12,
      }}>
        <div style={{ fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.inkMute, fontStyle: 'italic' }}>
          {lang === 'nl' ? 'Geen co-op ritten dit jaar.' : 'No co-op trips this year.'}
        </div>
      </div>
    );
  }
  const maxKm = contributions[0].km;
  return (
    <div style={{
      background: paperB.paper, padding: '16px 18px',
      borderTop: `2px solid ${paperB.ink}`, marginBottom: 12,
    }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
      }}>
        {lang === 'nl' ? 'Bijdrage per lid' : 'Contribution per member'}
      </div>
      {contributions.map(({ who, km, recovered }, i) => (
        <div key={who} style={{ marginBottom: i < contributions.length - 1 ? 10 : 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3,
          }}>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 10, color: paperB.ink,
              fontWeight: 700, letterSpacing: 0.5,
            }}>
              {i === 0 && <span style={{ color: paperB.amber }}>★ </span>}{who}
            </div>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim, letterSpacing: 0.5,
            }}>
              {km.toLocaleString('nl-BE')} km · {fmtMoney(recovered)}
            </div>
          </div>
          <div style={{ height: 6, background: paperB.paperDeep, border: `1px solid ${paperB.paperDark}` }}>
            <div style={{ height: '100%', width: Math.round((km / maxKm) * 100) + '%', background: paperB.blue }}/>
          </div>
        </div>
      ))}
      <div style={{
        borderTop: `1px dashed ${paperB.paperDark}`, marginTop: 12, paddingTop: 8,
        fontFamily: paperB.fontSerif, fontSize: 13, color: paperB.inkDim,
        fontStyle: 'italic', lineHeight: 1.4,
      }}>
        {lang === 'nl'
          ? `Samen reden anderen ${fe.kmOthers.toLocaleString('nl-BE')} km — goed voor ${fmtMoney(fe.recoveredYTD)} van de vaste kosten.`
          : `Together, others drove ${fe.kmOthers.toLocaleString('nl-BE')} km — covering ${fmtMoney(fe.recoveredYTD)} of fixed costs.`}
      </div>
    </div>
  );
}

// ── What-if rate slider
function WhatIfSlider({ fe, car, lang }) {
  const minRate = Math.ceil((fe.variablePerKm + 0.01) * 100) / 100;
  const maxRate = Math.round(car.prijs * 2.5 * 100) / 100;
  const [rate, setRate] = React.useState(car.prijs);

  const newFixed   = Math.max(0, rate - fe.variablePerKm);
  const newBEKm    = newFixed > 0 ? Math.ceil(fe.vasteTotal / newFixed) : Infinity;
  const newRecovery = Math.min(fe.vasteTotal, (fe.projectedYearlyKm || 0) * newFixed);
  const newBurden  = fe.vasteTotal - newRecovery;
  const reachable  = newBEKm !== Infinity && newBEKm <= (fe.projectedYearlyKm || 0);
  const delta      = rate - car.prijs;

  return (
    <div style={{
      background: paperB.paper, padding: '16px 18px',
      borderTop: `2px solid ${paperB.ink}`, marginBottom: 12,
    }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
      }}>
        {lang === 'nl' ? 'Wat als het tarief verandert?' : 'What if the rate changed?'}
      </div>

      {/* Slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkMute, minWidth: 38 }}>
          {fmtMoney(minRate).replace('€ ','€')}
        </span>
        <input type="range" min={minRate} max={maxRate} step={0.01} value={rate}
          onChange={e => setRate(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: paperB.ink, cursor: 'pointer' }}/>
        <span style={{ fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkMute, minWidth: 38, textAlign: 'right' }}>
          {fmtMoney(maxRate).replace('€ ','€')}
        </span>
      </div>

      {/* Rate display */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{
          fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
          color: paperB.ink, letterSpacing: -0.5,
        }}>
          {fmtMoney(rate).replace('€ ','€')}/km
        </span>
        {Math.abs(delta) >= 0.005 && (
          <span style={{
            fontFamily: paperB.fontMono, fontSize: 9, marginLeft: 8, letterSpacing: 1,
            color: delta > 0 ? paperB.green : paperB.accent,
          }}>
            {delta > 0 ? '+' : ''}{fmtMoney(delta).replace('€ ','€')}
          </span>
        )}
        {Math.abs(delta) < 0.005 && (
          <span style={{ fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute, marginLeft: 8, letterSpacing: 1 }}>
            {lang === 'nl' ? '= huidig tarief' : '= current rate'}
          </span>
        )}
      </div>

      {/* Impact */}
      <div style={{ background: paperB.paperDeep, padding: '10px 12px', border: `1px dashed ${paperB.paperDark}` }}>
        <ReceiptRow
          label={lang === 'nl' ? 'Break-even km' : 'Break-even km'}
          value={newBEKm === Infinity
            ? (lang === 'nl' ? 'Niet haalbaar' : 'Not achievable')
            : newBEKm.toLocaleString('nl-BE') + ' km'}
          color={reachable ? paperB.green : undefined}
        />
        <ReceiptRow
          label={lang === 'nl' ? 'Prognose eind 2026' : '2026 year-end'}
          value={reachable
            ? (lang === 'nl' ? 'Break-even haalbaar ✓' : 'Break-even reachable ✓')
            : `−${fmtMoney(newBurden)}`}
          color={reachable ? paperB.green : (newBurden > (fe.projectedBurden || 0) ? paperB.accent : undefined)}
        />
      </div>

      {/* Narrative */}
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 13, color: paperB.inkDim,
        fontStyle: 'italic', lineHeight: 1.4, marginTop: 10,
      }}>
        {reachable
          ? (lang === 'nl'
              ? `Aan ${fmtMoney(rate).replace('€ ','€')}/km bereikt ${car.name} break-even — ${newBEKm.toLocaleString('nl-BE')} km is haalbaar op dit tempo.`
              : `At ${fmtMoney(rate).replace('€ ','€')}/km, ${car.name} reaches break-even — ${newBEKm.toLocaleString('nl-BE')} km is achievable at this pace.`)
          : (lang === 'nl'
              ? `Aan ${fmtMoney(rate).replace('€ ','€')}/km eindigt het jaar op −${fmtMoney(newBurden)} voor ${car.name}.`
              : `At ${fmtMoney(rate).replace('€ ','€')}/km, ${car.name} ends the year at −${fmtMoney(newBurden)}.`)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── BreakEvenDetail — per-car screen (analysis + editable settings)
// ══════════════════════════════════════════════════════════════════
function BreakEvenDetail({ car, lang, onBack }) {
  const t = strings[lang];

  // Local editable copy — changes here update all live visualizations above
  const [carDraft, setCarDraft] = React.useState(() => ({
    ...car, fixedCosts: (car.fixedCosts || []).map(c => ({ ...c })),
  }));
  const [helperVariant, setHelperVariant] = React.useState('story');

  const fe  = fleetEconomics(carDraft);

  const setCar       = (patch) => setCarDraft(d => ({ ...d, ...patch }));
  const setFixedCosts = (fc)   => setCarDraft(d => ({ ...d, fixedCosts: fc }));

  const varW = carDraft.prijs > 0 ? (fe.variablePerKm / carDraft.prijs) * 100 : 0;
  const fixW = carDraft.prijs > 0 ? (fe.fixedContributionPerKm / carDraft.prijs) * 100 : 0;

  return (
    <div>
      {/* Breadcrumb / back */}
      <div style={{ padding: '10px 20px 4px' }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', padding: 0,
          fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 2,
          textTransform: 'uppercase', color: paperB.inkDim, cursor: 'pointer',
        }}>← {lang === 'nl' ? 'Vloot' : 'Fleet'}</button>
      </div>

      {/* Compact bucket — live from carDraft */}
      <div style={{ padding: '6px 16px 0' }}>
        <BucketCard car={carDraft} fe={fe} lang={lang} compact/>
      </div>

      {/* Hero: break-even curve */}
      <div style={{ padding: '0 16px' }}>
        <BreakEvenCurve fe={fe} car={carDraft} lang={lang}/>
      </div>

      {/* Contribution ledger */}
      <div style={{ padding: '0 16px' }}>
        <ContributionLedger fe={fe} lang={lang}/>
      </div>

      {/* What-if rate slider */}
      <div style={{ padding: '0 16px' }}>
        <WhatIfSlider fe={fe} car={carDraft} lang={lang}/>
      </div>

      {/* ── Editable car settings ─────────────────────────────── */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: paperB.paper, padding: '16px 18px',
          borderTop: `2px solid ${paperB.ink}`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: 12,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>{lang === 'nl' ? 'Wageninstellingen' : 'Car settings'}</div>

          {/* Km price + long threshold */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <NumberField
              label={lang === 'nl' ? 'Km-prijs' : 'Km rate'}
              value={carDraft.prijs} step="0.01" suffix="€/km"
              onChange={v => setCar({ prijs: v })}/>
            <NumberField
              label={lang === 'nl' ? 'Lange-rit grens' : 'Long-trip threshold'}
              value={carDraft.longKm} step="50" suffix="km"
              onChange={v => setCar({ longKm: v })}/>
          </div>

          <Perf/>

          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 10,
          }}>{lang === 'nl' ? 'Jaarlijkse vaste kosten' : 'Yearly fixed costs'}</div>

          <FixedCostEditor
            items={carDraft.fixedCosts || []}
            onChange={setFixedCosts}
            lang={lang}
          />
        </div>
      </div>

      {/* Km-price decomposition — live from carDraft */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: paperB.paper, padding: '16px 18px',
          borderTop: `2px solid ${paperB.ink}`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: 8,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10,
          }}>{lang === 'nl' ? 'Km-prijs — uit wat bestaat die?' : 'Km-rate — what\'s in it?'}</div>

          <div style={{ display: 'flex', height: 32, marginBottom: 8, border: `1.5px solid ${paperB.ink}` }}>
            <div style={{
              width: varW + '%', background: paperB.amber,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: paperB.fontMono, fontSize: 10, color: paperB.ink, fontWeight: 700,
            }}>{fmtMoney(fe.variablePerKm).replace('€ ','€')}</div>
            <div style={{
              width: fixW + '%', background: paperB.blue, color: paperB.paper,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: paperB.fontMono, fontSize: 10, fontWeight: 700,
              borderLeft: `1px solid ${paperB.ink}`,
            }}>{fmtMoney(fe.fixedContributionPerKm).replace('€ ','€')}</div>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            <div><span style={{ color: paperB.amber, fontSize: 12 }}>■</span>&nbsp;{lang === 'nl' ? 'brandstof + slijtage' : 'fuel + wear'}</div>
            <div><span style={{ color: paperB.blue, fontSize: 12 }}>■</span>&nbsp;{lang === 'nl' ? 'vaste-kosten bijdrage' : 'fixed-cost contribution'}</div>
          </div>
          <Perf margin="14px 0 10px"/>
          <div style={{ fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.ink, lineHeight: 1.45, fontStyle: 'italic' }}>
            {lang === 'nl'
              ? <>Eigenaar ({fe.ownerIds[0]}) rijdt aan <b>{fmtMoney(fe.variablePerKm)}/km</b>. Anderen betalen <b>{fmtMoney(carDraft.prijs)}/km</b> — het verschil vult de emmer.</>
              : <>Owner ({fe.ownerIds[0]}) drives at <b>{fmtMoney(fe.variablePerKm)}/km</b>. Others pay <b>{fmtMoney(carDraft.prijs)}/km</b> — the difference fills the bucket.</>}
          </div>
        </div>
      </div>

      {/* Km-price helper toggle + component */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        {[
          { k: 'story', l: lang === 'nl' ? 'Verhaal' : 'Story' },
          { k: 'calc',  l: lang === 'nl' ? 'Rekenmachine' : 'Calculator' },
        ].map(v => {
          const sel = v.k === helperVariant;
          return (
            <button key={v.k} onClick={() => setHelperVariant(v.k)} style={{
              flex: 1, padding: '8px',
              border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
              background: sel ? paperB.ink : paperB.paper,
              color: sel ? paperB.paper : paperB.ink, cursor: 'pointer',
              fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
              textTransform: 'uppercase', fontWeight: 700,
            }}>{v.l}</button>
          );
        })}
      </div>
      <div style={{ padding: '0 16px' }}>
        {helperVariant === 'story'
          ? <KmPriceHelperStory car={carDraft} lang={lang}/>
          : <KmPriceHelperCalc  car={carDraft} lang={lang}/>}
      </div>

      {/* Expected vs actual */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          background: paperB.paper, padding: '16px 18px',
          borderTop: `2px solid ${paperB.ink}`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: 12,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10,
          }}>{lang === 'nl' ? 'Co-op km · verwacht vs. werkelijk' : 'Co-op km · expected vs. actual'}</div>
          <div style={{ fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink, lineHeight: 1.5 }}>
            {lang === 'nl'
              ? <>Verwacht: <b>{fe.expectedCoopKm.toLocaleString('nl-BE')} km</b> dit jaar.<br/>
                   Tot nu toe: <b>{fe.kmOthers.toLocaleString('nl-BE')} km</b>{' '}({Math.round(fe.pctOfExpected)}% van verwacht).</>
              : <>Expected: <b>{fe.expectedCoopKm.toLocaleString('nl-BE')} km</b> this year.<br/>
                   So far: <b>{fe.kmOthers.toLocaleString('nl-BE')} km</b>{' '}({Math.round(fe.pctOfExpected)}% of expected).</>}
          </div>
          <div style={{ marginTop: 10, height: 14, background: paperB.paperDeep, border: `1.5px solid ${paperB.ink}`, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, fe.pctOfExpected) + '%', background: paperB.ink }}/>
            <div style={{ position: 'absolute', left: '100%', top: -4, bottom: -4, width: 2, background: paperB.accent }}/>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1, textTransform: 'uppercase', marginTop: 4,
          }}>
            <div>0 km</div>
            <div>{lang === 'nl' ? 'jaardoel' : 'year goal'} · {fe.expectedCoopKm.toLocaleString('nl-BE')} km</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════
// ── NarratedPayout — story-driven replacement for AdminPayout
//    Tells the payout as: "anderen reden X km voor deze wagen,
//    daarvan ging Y naar je vaste-kosten-emmer, Z heb je al uit eigen zak
//    gelegd. Het verschil is de uitbetaling."
// ═════════════════════════════════════════════════════════════════
function NarratedPayout({ lang }) {
  const t = strings[lang];
  const { role, me } = useRole();
  const year = 2026;

  // Owner sees only their own cars
  const visibleCars = role === 'owner'
    ? CARS.filter(c => (c.ownerIds || [c.eigenaar]).includes(me))
    : CARS;

  // Group visible cars by owner
  const owners = {};
  for (const c of visibleCars) {
    const fe = fleetEconomics(c);
    const a = fe.agg;
    for (const o of fe.ownerIds) {
      if (!owners[o]) owners[o] = { owner: o, cars: [], bucketFilled: 0, advanced: 0, deductRecovered: 0, ownerOwnUsage: 0 };
      // bucketFilled: sum of recoveredYTD (capped at vasteTotal per car) — what others put into owner's bucket
      const filled = Math.min(fe.recoveredYTD, fe.vasteTotal);
      // Advanced: fuel + maintenance the owner personally paid out of pocket
      const ownerFuel = a.fuel.filter(f => f.who === o).reduce((s,f) => s + f.bedrag, 0);
      const ownerExp  = a.exp .filter(e => e.who === o).reduce((s,e) => s + e.bedrag, 0);
      // Owner's own usage at cost-price (variable only — they don't pay rent to themselves)
      const ownerOwn = fe.kmOwner * fe.variablePerKm;
      owners[o].cars.push({ car: c, fe, filled, ownerFuel, ownerExp, ownerOwn });
      owners[o].bucketFilled += filled;
      owners[o].advanced += ownerFuel + ownerExp;
      owners[o].ownerOwnUsage += ownerOwn;
    }
  }
  const ownerList = Object.values(owners);

  return (
    <div>
      {/* Intro */}
      <div style={{
        padding: '16px 20px 8px', background: paperB.paper,
        borderBottom: `1.5px dashed ${paperB.ink}`,
      }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
        }}>— {lang === 'nl' ? 'Jaaruitbetaling' : 'Year payout'} · {year} —</div>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 18, color: paperB.ink,
          lineHeight: 1.45, fontStyle: 'italic',
        }}>
          {lang === 'nl'
            ? 'Twee rekeningen, niet één. Eerst: wat staat er in je vaste-kosten-emmer? Dan: wat heb je voorgeschoten?'
            : 'Two ledgers, not one. First: what\'s in your fixed-cost bucket? Then: what did you advance?'}
        </div>
      </div>

      {ownerList.map(o => <OwnerPayoutStory key={o.owner} owner={o} lang={lang}/>)}

      {/* Global actions */}
      <div style={{ padding: '8px 16px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <AdminButton size="sm">⎘ {lang === 'nl' ? 'Kopieer alle' : 'Copy all'}</AdminButton>
        <AdminButton size="sm" variant="ghost">↓ {t.exportPdf}</AdminButton>
        <AdminButton size="sm" variant="ghost">✉ {lang === 'nl' ? 'Mail naar eigenaars' : 'Email owners'}</AdminButton>
      </div>
    </div>
  );
}

function OwnerPayoutStory({ owner, lang }) {
  // The story, per owner
  const totalBucketOthers = owner.bucketFilled;                    // co-op's contribution to fixed costs
  const totalVasteOwned   = owner.cars.reduce((s, c) => s + c.fe.vasteTotal, 0);
  const ownerOwnShare     = totalVasteOwned - totalBucketOthers;   // what owner still carries of fixed costs
  const ownerOwnShareFloor= Math.max(0, ownerOwnShare);            // can't be negative (surplus case)

  const payout = totalBucketOthers + owner.advanced;               // what owner is owed
  // Interpretation: co-op collected X from others (revenue into bucket) + owner advanced Y from own pocket.
  // Owner gets X back (bucket contents) + Y (advances) = total payout.

  return (
    <div style={{ padding: '14px 16px 6px' }}>
      {/* Owner header */}
      <div style={{
        background: paperB.ink, color: paperB.paper,
        padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
            textTransform: 'uppercase', color: paperB.paperDark,
          }}>{lang === 'nl' ? 'Eigenaar' : 'Owner'}</div>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 22, fontWeight: 700,
            letterSpacing: -0.3, lineHeight: 1, marginTop: 2,
          }}>{owner.owner}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
            textTransform: 'uppercase', color: paperB.paperDark,
          }}>{lang === 'nl' ? 'Ontvangt' : 'Receives'}</div>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 26, fontWeight: 700,
            letterSpacing: -0.5, lineHeight: 1, marginTop: 2, color: paperB.green,
          }}>+ {fmtMoney(payout)}</div>
        </div>
      </div>

      {/* The narrative, in 3 acts */}
      <div style={{ background: paperB.paper, padding: '16px 18px 10px' }}>
        {/* Act 1 — Bucket */}
        <StoryAct
          num="1"
          title={lang === 'nl' ? 'Anderen vulden je emmer' : 'Others filled your bucket'}
          amount={`+ ${fmtMoney(totalBucketOthers)}`}
          color={paperB.blue}
          body={lang === 'nl'
            ? <>Op {owner.cars.length === 1 ? `${owner.cars[0].car.name}` : `je ${owner.cars.length} wagens`} reden co-op-leden dit jaar samen{' '}
               <b>{owner.cars.reduce((s,c) => s + c.fe.kmOthers, 0).toLocaleString('nl-BE')} km</b>.
               Elk van die km droeg bij aan je vaste kosten.</>
            : <>On {owner.cars.length === 1 ? `${owner.cars[0].car.name}` : `your ${owner.cars.length} cars`} co-op members drove{' '}
               <b>{owner.cars.reduce((s,c) => s + c.fe.kmOthers, 0).toLocaleString('nl-BE')} km</b> this year.
               Each km contributed to your fixed costs.</>}
        />

        {/* Act 2 — Advanced */}
        <StoryAct
          num="2"
          title={lang === 'nl' ? 'Je schoot zelf voor' : 'You advanced out of pocket'}
          amount={`+ ${fmtMoney(owner.advanced)}`}
          color={paperB.amber}
          body={lang === 'nl'
            ? <>Brandstof betaald, keuring afgerekend, uitlijning bij Donckers — dat wordt nu rechtgezet.</>
            : <>Fuel paid, inspection settled, tyre alignment at Donckers — all reimbursed now.</>}
        />

        {/* Sum */}
        <div style={{
          borderTop: `1.5px dashed ${paperB.ink}`,
          marginTop: 14, padding: '12px 0 4px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
            letterSpacing: 1.5, textTransform: 'uppercase', color: paperB.ink,
          }}>Σ {lang === 'nl' ? 'Uitbetaling' : 'Payout'}</div>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 22, fontWeight: 700,
            color: paperB.green,
          }}>+ {fmtMoney(payout)}</div>
        </div>

        {/* Epilogue */}
        <div style={{
          background: paperB.paperDeep, padding: '10px 14px', marginTop: 12,
          fontFamily: paperB.fontSerif, fontSize: 13, color: paperB.inkDim,
          fontStyle: 'italic', lineHeight: 1.5,
        }}>
          {ownerOwnShareFloor > 0.01
            ? (lang === 'nl'
               ? <>Je blijft nog <b>{fmtMoney(ownerOwnShareFloor)}</b> aan vaste kosten zelf dragen — {' '}
                  het deel dat overeenkomt met je <b>eigen gereden km</b>. Dat is correct: jij hoort jezelf geen huur te betalen.</>
               : <>You still personally carry <b>{fmtMoney(ownerOwnShareFloor)}</b> of fixed costs — {' '}
                  the share matching your <b>own km driven</b>. That's correct: you shouldn't pay rent to yourself.</>)
            : (lang === 'nl'
               ? <>De co-op dekte dit jaar al je vaste kosten <b>volledig</b>. Alles wat er bij kwam was overschot.</>
               : <>The co-op fully covered your fixed costs this year. Anything beyond that was surplus.</>)}
        </div>
      </div>

      {/* Per-car breakdown — collapsible */}
      <OwnerCarBreakdown owner={owner} lang={lang}/>
    </div>
  );
}

function StoryAct({ num, title, amount, color, body }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '12px 0',
      borderBottom: `1px dotted ${paperB.paperDark}`,
    }}>
      <div style={{
        width: 40, flexShrink: 0,
        fontFamily: paperB.fontSerif, fontSize: 38, fontWeight: 700,
        color: color, lineHeight: 0.9, letterSpacing: -2,
        opacity: 0.85,
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 4,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700,
          }}>{title}</div>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 17, fontWeight: 700,
            color: color, letterSpacing: -0.3,
          }}>{amount}</div>
        </div>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.ink,
          lineHeight: 1.5,
        }}>{body}</div>
      </div>
    </div>
  );
}

function OwnerCarBreakdown({ owner, lang }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ padding: '2px 0 0' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: paperB.paper,
        padding: '10px 18px', border: 'none',
        borderTop: `1px dashed ${paperB.paperDark}`,
        textAlign: 'left', cursor: 'pointer',
        fontFamily: paperB.fontMono, fontSize: 10,
        letterSpacing: 1.5, textTransform: 'uppercase', color: paperB.inkDim,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{lang === 'nl' ? 'Detail per wagen' : 'Per-car detail'}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 14px', background: paperB.paper }}>
          {owner.cars.map(row => (
            <div key={row.car.short} style={{
              padding: '12px 0',
              borderTop: `1px dotted ${paperB.paperDark}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <CarStamp code={row.car.short} active size="sm"/>
                <div style={{
                  fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 700,
                  color: paperB.ink, flex: 1,
                }}>{row.car.name}</div>
              </div>
              <ReceiptRow
                label={lang === 'nl' ? `Emmer-bijdrage (${row.fe.kmOthers.toLocaleString('nl-BE')} km × ${fmtMoney(row.fe.fixedContributionPerKm).replace('€ ','€')})` : `Bucket fill (${row.fe.kmOthers.toLocaleString('nl-BE')} km × ${fmtMoney(row.fe.fixedContributionPerKm).replace('€ ','€')})`}
                value={`+ ${fmtMoney(row.filled)}`}
              />
              <ReceiptRow
                label={lang === 'nl' ? 'Voorgeschoten brandstof' : 'Fuel advanced'}
                value={`+ ${fmtMoney(row.ownerFuel)}`}
              />
              <ReceiptRow
                label={lang === 'nl' ? 'Voorgeschoten onderhoud' : 'Maintenance advanced'}
                value={`+ ${fmtMoney(row.ownerExp)}`}
              />
              <Perf margin="6px 0 4px"/>
              <ReceiptRow
                label={lang === 'nl' ? 'Subtotaal' : 'Subtotal'}
                value={fmtMoney(row.filled + row.ownerFuel + row.ownerExp)}
                big
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// ── RateAssistant — January decision flow
//    Step 1: review last year's km and costs for the car
//    Step 2: pick expected co-op km for this year (with anchors)
//    Step 3: try a km-price, see how full bucket gets
//    Step 4: commit — locks the rate for the year
// ═════════════════════════════════════════════════════════════════
function RateAssistant({ lang }) {
  const t = strings[lang];
  const [selected, setSelected] = React.useState(CARS[0].short);
  const [step, setStep]         = React.useState(1);
  const [expectedKm, setExpectedKm] = React.useState(null);
  const [proposedRate, setProposedRate] = React.useState(null);

  const car = carByShort[selected];
  const a = carYearAggregates(car);
  const s = suggestedKmPrice(car);
  const lastYearKm = car.jaarKm;

  // initialize on car change
  React.useEffect(() => {
    setStep(1);
    setExpectedKm(car.expectedCoopKm);
    setProposedRate(car.prijs);
  }, [selected]);

  if (expectedKm === null) return null;

  const variablePerKm = s.varCost;
  const fixedContribPerKm = Math.max(0, proposedRate - variablePerKm);
  const vasteTotal = a.vasteTotal;
  const projectedRecovery = fixedContribPerKm * expectedKm;
  const projectedPct = (projectedRecovery / vasteTotal) * 100;
  const projectedShortfall = vasteTotal - projectedRecovery;

  return (
    <div>
      {/* Car picker */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 8 }}>
        {CARS.map(c => (
          <button key={c.short} onClick={() => setSelected(c.short)} style={{
            flex: 1, padding: '10px 8px',
            border: `1.5px ${c.short === selected ? 'solid' : 'dashed'} ${paperB.ink}`,
            background: c.short === selected ? paperB.ink : paperB.paper,
            color: c.short === selected ? paperB.paper : paperB.ink,
            cursor: 'pointer', fontFamily: paperB.fontMono, fontWeight: 700,
            transform: c.short === selected ? 'rotate(-1deg)' : 'none',
          }}>
            <div style={{ fontSize: 13, letterSpacing: 2 }}>{c.short}</div>
            <div style={{ fontSize: 9, marginTop: 2, opacity: 0.75 }}>{c.merk}</div>
          </button>
        ))}
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        padding: '6px 16px 14px',
      }}>
        {[1,2,3,4].map(n => (
          <div key={n} onClick={() => setStep(n)} style={{
            width: n === step ? 32 : 10, height: 10,
            background: n <= step ? paperB.ink : paperB.paperDark,
            cursor: 'pointer', transition: 'width 0.2s',
          }}/>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {step === 1 && (
          <RateStep title={lang === 'nl' ? '① Vorig jaar, samengevat' : '① Last year, recap'}
            subtitle={lang === 'nl' ? 'Een eerlijk beeld voordat we beslissen.' : 'An honest picture before we decide.'}
            onNext={() => setStep(2)} nextLabel={lang === 'nl' ? 'Verder — km schatten →' : 'Next — estimate km →'}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              marginBottom: 14,
            }}>
              <StatTile label={lang === 'nl' ? 'Totaal gereden' : 'Total driven'}
                value={`${lastYearKm.toLocaleString('nl-BE')}`} suffix="km"/>
              <StatTile label={lang === 'nl' ? 'Co-op gereden' : 'Co-op driven'}
                value={`${(a.trips.filter(t => !car.ownerIds.includes(t.who)).reduce((s,t) => s + t.km, 0)).toLocaleString('nl-BE')}`}
                suffix="km"/>
              <StatTile label={lang === 'nl' ? 'Variabele kost/km' : 'Variable cost/km'}
                value={fmtMoney(variablePerKm)} muted/>
              <StatTile label={lang === 'nl' ? 'Vaste kost/jaar' : 'Fixed cost/yr'}
                value={fmtMoney(vasteTotal)} muted/>
            </div>

            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 15, lineHeight: 1.55,
              color: paperB.ink, fontStyle: 'italic',
              borderLeft: `3px solid ${paperB.accent}`, paddingLeft: 12,
            }}>
              {lang === 'nl' ? (
                <>Met <b>€ {car.prijs.toFixed(2).replace('.',',')}/km</b> vorig jaar:
                de co-op-km dekten <b>{Math.round((a.trips.filter(t => !car.ownerIds.includes(t.who)).reduce((s,t) => s + t.km, 0) * (car.prijs - variablePerKm)) / vasteTotal * 100)}%</b> van
                de vaste kosten van {car.name}.</>
              ) : (
                <>At <b>€ {car.prijs.toFixed(2).replace('.',',')}/km</b> last year:
                co-op km covered <b>{Math.round((a.trips.filter(t => !car.ownerIds.includes(t.who)).reduce((s,t) => s + t.km, 0) * (car.prijs - variablePerKm)) / vasteTotal * 100)}%</b> of
                {car.name}'s fixed costs.</>
              )}
            </div>
          </RateStep>
        )}

        {step === 2 && (
          <RateStep title={lang === 'nl' ? '② Hoeveel km verwacht je dit jaar?' : '② How many km do you expect this year?'}
            subtitle={lang === 'nl' ? 'Alleen co-op-km — niet je eigen gebruik.' : 'Co-op km only — not your own usage.'}
            onBack={() => setStep(1)} onNext={() => setStep(3)}
            nextLabel={lang === 'nl' ? 'Verder — tarief kiezen →' : 'Next — choose rate →'}>
            {/* Big number input */}
            <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 54, fontWeight: 700,
                color: paperB.ink, letterSpacing: -2, lineHeight: 1,
              }}>{expectedKm.toLocaleString('nl-BE')}</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 11, color: paperB.inkDim,
                letterSpacing: 2, textTransform: 'uppercase', marginTop: 4,
              }}>km / {lang === 'nl' ? 'jaar' : 'year'}</div>
            </div>

            <input type="range"
              min={Math.max(500, Math.round(lastYearKm * 0.2 / 500) * 500)}
              max={Math.round(lastYearKm * 0.9 / 500) * 500}
              step="500"
              value={expectedKm}
              onChange={e => setExpectedKm(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: paperB.ink }}/>

            {/* Anchor chips */}
            <div style={{
              display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap',
            }}>
              {[
                { l: lang === 'nl' ? 'Vorig jaar co-op' : 'Last yr co-op',
                  v: Math.round(a.trips.filter(t => !car.ownerIds.includes(t.who)).reduce((s,t) => s + t.km, 0) / 500) * 500 || car.expectedCoopKm },
                { l: lang === 'nl' ? '−10%' : '−10%', v: Math.round(car.expectedCoopKm * 0.9 / 500) * 500 },
                { l: lang === 'nl' ? 'Zelfde' : 'Same', v: car.expectedCoopKm },
                { l: lang === 'nl' ? '+10%' : '+10%', v: Math.round(car.expectedCoopKm * 1.1 / 500) * 500 },
              ].map((chip, i) => (
                <button key={i} onClick={() => setExpectedKm(chip.v)} style={{
                  flex: '1 1 auto', padding: '6px 10px',
                  background: expectedKm === chip.v ? paperB.ink : 'transparent',
                  color: expectedKm === chip.v ? paperB.paper : paperB.ink,
                  border: `1.5px ${expectedKm === chip.v ? 'solid' : 'dashed'} ${paperB.ink}`,
                  fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1,
                  textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
                }}>
                  {chip.l}<br/>
                  <span style={{ fontSize: 9, opacity: 0.75 }}>{chip.v.toLocaleString('nl-BE')}</span>
                </button>
              ))}
            </div>

            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: paperB.paperDeep,
              fontFamily: paperB.fontSerif, fontSize: 13, color: paperB.inkDim,
              fontStyle: 'italic', lineHeight: 1.5,
            }}>
              {lang === 'nl'
                ? 'Dit is een schatting — aan het eind van het jaar zien we het echte getal. Niet te optimistisch zijn is slim: tarief wordt dan lichtjes hoger, en dat geeft ademruimte.'
                : 'This is an estimate — year-end reveals the real number. Erring conservative is wise: rate goes a bit higher, giving breathing room.'}
            </div>
          </RateStep>
        )}

        {step === 3 && (
          <RateStep title={lang === 'nl' ? '③ Welk tarief vraag je?' : '③ What rate will you charge?'}
            subtitle={lang === 'nl' ? 'Zie live hoe vol je emmer wordt.' : 'See your bucket fill live.'}
            onBack={() => setStep(2)} onNext={() => setStep(4)}
            nextLabel={lang === 'nl' ? 'Verder — bevestigen →' : 'Next — confirm →'}>

            {/* Live bucket preview */}
            <div style={{ margin: '6px 0 16px' }}>
              <div style={{
                position: 'relative', height: 110,
                background: paperB.paperDeep,
                border: `1.5px solid ${paperB.ink}`,
              }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  height: Math.min(100, projectedPct) + '%',
                  background: projectedPct >= 100
                    ? `repeating-linear-gradient(45deg, ${paperB.green} 0 6px, ${paperB.paper}44 6px 12px)`
                    : `linear-gradient(180deg, ${paperB.blue}aa, ${paperB.blue})`,
                  transition: 'height 0.3s ease-out',
                }}/>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
                    color: paperB.ink, textShadow: '0 0 8px ' + paperB.paper + 'cc',
                  }}>{fmtMoney(Math.min(projectedRecovery, vasteTotal))}</div>
                  <div style={{
                    fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2,
                    textShadow: '0 0 6px ' + paperB.paper + 'cc',
                  }}>{lang === 'nl' ? 'van' : 'of'} {fmtMoney(vasteTotal)} {lang === 'nl' ? 'eind jaar' : 'by year end'}</div>
                </div>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 6,
                fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
                letterSpacing: 1.2, textTransform: 'uppercase',
              }}>
                <div>0%</div>
                <div>{Math.round(projectedPct)}% {lang === 'nl' ? 'verwacht' : 'projected'}</div>
                <div>100%</div>
              </div>
            </div>

            {/* Rate slider */}
            <div style={{
              textAlign: 'center', fontFamily: paperB.fontSerif,
              fontSize: 46, fontWeight: 700, color: paperB.ink, lineHeight: 1,
              letterSpacing: -1.5, margin: '10px 0 4px',
            }}>€ {proposedRate.toFixed(2).replace('.', ',')}</div>
            <div style={{
              textAlign: 'center', fontFamily: paperB.fontMono, fontSize: 10,
              color: paperB.inkDim, letterSpacing: 2, textTransform: 'uppercase',
              marginBottom: 8,
            }}>per km · {lang === 'nl' ? 'voorstel' : 'proposed'}</div>

            <input type="range" min="0.10" max="0.50" step="0.01" value={proposedRate}
              onChange={e => setProposedRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: paperB.blue }}/>

            {/* Current + break-even rate anchors */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
              letterSpacing: 1, marginTop: 4,
            }}>
              <span>€ 0,10</span>
              <span>{lang === 'nl' ? 'huidig:' : 'now:'} € {car.prijs.toFixed(2).replace('.',',')}</span>
              <span>€ 0,50</span>
            </div>

            {/* Quick pick chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { l: lang === 'nl' ? 'Huidig' : 'Current', v: car.prijs },
                { l: lang === 'nl' ? 'Kost-dekkend' : 'Cost-covering',
                  v: Math.round((variablePerKm + vasteTotal / expectedKm) * 100) / 100 },
                { l: lang === 'nl' ? '+5%' : '+5%', v: Math.round(car.prijs * 1.05 * 100) / 100 },
              ].map((chip, i) => (
                <button key={i} onClick={() => setProposedRate(chip.v)} style={{
                  flex: '1 1 auto', padding: '7px 10px',
                  background: proposedRate === chip.v ? paperB.ink : 'transparent',
                  color: proposedRate === chip.v ? paperB.paper : paperB.ink,
                  border: `1.5px ${proposedRate === chip.v ? 'solid' : 'dashed'} ${paperB.ink}`,
                  fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1,
                  textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
                }}>
                  {chip.l}<br/>
                  <span style={{ fontSize: 9, opacity: 0.75 }}>€ {chip.v.toFixed(2).replace('.',',')}</span>
                </button>
              ))}
            </div>

            {/* Verdict callout */}
            <div style={{
              marginTop: 14, padding: '12px 14px',
              borderLeft: `3px solid ${projectedPct >= 100 ? paperB.green : projectedPct >= 80 ? paperB.amber : paperB.accent}`,
              background: paperB.paperDeep,
              fontFamily: paperB.fontSerif, fontSize: 14, lineHeight: 1.5, color: paperB.ink,
            }}>
              {projectedPct >= 100 ? (
                lang === 'nl'
                  ? <>Met dit tarief vul je je emmer <b>volledig</b>. Overschot van <b style={{ color: paperB.green }}>{fmtMoney(projectedRecovery - vasteTotal)}</b> gaat naar je eigen zak.</>
                  : <>This rate fills your bucket <b>completely</b>. Surplus of <b style={{ color: paperB.green }}>{fmtMoney(projectedRecovery - vasteTotal)}</b> goes to you.</>
              ) : projectedPct >= 80 ? (
                lang === 'nl'
                  ? <>Dicht bij break-even: <b style={{ color: paperB.amber }}>{fmtMoney(projectedShortfall)} tekort</b>. Marge is krap — een grote reparatie kan je pijn doen.</>
                  : <>Close to break-even: <b style={{ color: paperB.amber }}>{fmtMoney(projectedShortfall)} short</b>. Tight margin — a major repair could hurt.</>
              ) : (
                lang === 'nl'
                  ? <>Let op: <b style={{ color: paperB.accent }}>{fmtMoney(projectedShortfall)} tekort</b>. Je draagt zelf een groot deel van de vaste kosten.</>
                  : <>Warning: <b style={{ color: paperB.accent }}>{fmtMoney(projectedShortfall)} short</b>. You'll personally carry a big chunk of fixed costs.</>
              )}
            </div>
          </RateStep>
        )}

        {step === 4 && (
          <RateStep title={lang === 'nl' ? '④ Bevestigen' : '④ Confirm'}
            subtitle={lang === 'nl' ? 'Dit legt het tarief vast voor dit jaar.' : 'This locks the rate for the year.'}
            onBack={() => setStep(3)}>
            <div style={{
              background: paperB.paper, padding: '16px 18px',
              border: `2px solid ${paperB.ink}`,
              boxShadow: '4px 4px 0 ' + paperB.ink + '22',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              }}>
                <CarStamp code={car.short} active/>
                <div style={{
                  fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
                  color: paperB.ink,
                }}>{car.name}</div>
                <Stamp rotate={6} color={paperB.accent} size="sm">
                  {lang === 'nl' ? 'VOORSTEL' : 'DRAFT'}
                </Stamp>
              </div>

              <ReceiptRow label={lang === 'nl' ? 'Km-prijs' : 'Km rate'}
                value={`€ ${proposedRate.toFixed(2).replace('.',',')}/km`}
                big color={paperB.ink}/>
              <ReceiptRow label={lang === 'nl' ? 'Verwachte co-op km' : 'Expected co-op km'}
                value={expectedKm.toLocaleString('nl-BE') + ' km'}/>
              <Perf margin="8px 0"/>
              <ReceiptRow label={lang === 'nl' ? 'Verwachte dekking' : 'Projected recovery'}
                value={fmtMoney(Math.min(projectedRecovery, vasteTotal))}/>
              <ReceiptRow label={lang === 'nl' ? 'Vaste kosten' : 'Fixed costs'}
                value={fmtMoney(vasteTotal)}/>
              <Perf margin="8px 0"/>
              <ReceiptRow
                label={projectedPct >= 100 ? (lang === 'nl' ? 'Verwacht overschot' : 'Projected surplus') : (lang === 'nl' ? 'Verwacht tekort' : 'Projected shortfall')}
                value={(projectedPct >= 100 ? '+ ' : '− ') + fmtMoney(Math.abs(projectedRecovery - vasteTotal))}
                big
                color={projectedPct >= 100 ? paperB.green : paperB.accent}/>

              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <AdminButton>✓ {lang === 'nl' ? 'Vastleggen voor 2026' : 'Lock in for 2026'}</AdminButton>
                <AdminButton variant="ghost" size="sm">✉ {lang === 'nl' ? 'Mail leden' : 'Email members'}</AdminButton>
              </div>
            </div>

            <div style={{
              marginTop: 14,
              fontFamily: paperB.fontSerif, fontSize: 13, color: paperB.inkDim,
              fontStyle: 'italic', lineHeight: 1.5, padding: '0 4px',
            }}>
              {lang === 'nl'
                ? 'Na bevestiging zie je elke maand op het Vloot-scherm hoeveel van de emmer al gevuld is.'
                : 'After confirming, the Fleet screen shows each month how much of the bucket is already filled.'}
            </div>
          </RateStep>
        )}
      </div>
    </div>
  );
}

function RateStep({ title, subtitle, children, onBack, onNext, nextLabel }) {
  return (
    <div style={{
      background: paperB.paper,
      padding: '18px 18px 16px',
      borderTop: `2px solid ${paperB.ink}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.04)',
      marginBottom: 14,
    }}>
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
        color: paperB.ink, letterSpacing: -0.3, lineHeight: 1.1, marginBottom: 4,
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
        }}>{subtitle}</div>
      )}
      <div>{children}</div>

      {(onBack || onNext) && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 16,
          borderTop: `1px dashed ${paperB.paperDark}`, paddingTop: 14,
        }}>
          {onBack && <AdminButton onClick={onBack} variant="ghost" size="sm">← {'Back'}</AdminButton>}
          {onNext && <div style={{ flex: 1 }}><AdminButton onClick={onNext}>{nextLabel || 'Next →'}</AdminButton></div>}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, suffix, muted }) {
  return (
    <div style={{
      background: paperB.paperDeep, padding: '10px 12px',
      borderLeft: `3px solid ${muted ? paperB.inkDim : paperB.ink}`,
    }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: muted ? 17 : 22, fontWeight: 700,
          color: muted ? paperB.inkDim : paperB.ink, lineHeight: 1,
        }}>{value}</div>
        {suffix && <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        }}>{suffix}</div>}
      </div>
    </div>
  );
}

Object.assign(window, { BucketCard, AdminFleet, BreakEvenDetail, NarratedPayout, RateAssistant, OwnerPayoutStory, StoryAct, OwnerCarBreakdown, RateStep, StatTile });
