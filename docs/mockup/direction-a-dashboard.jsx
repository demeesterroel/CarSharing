// Direction A — "Dashboard on Wheels"
// Premium dark mode. Car instrument cluster metaphor.
// Amber + deep navy. Odometer as dial. Feels like sitting inside the car.

const dashA = {
  bg: '#0d1117',
  bgCard: '#161b22',
  bgElev: '#1f2630',
  border: '#2a3240',
  text: '#f0f3f8',
  textDim: '#8b96a7',
  textMute: '#5c6677',
  amber: '#ffa726',
  amberDim: '#b87a1c',
  green: '#4ade80',
  red: '#f87171',
  fontBody: '"Inter", -apple-system, system-ui, sans-serif',
  fontDisplay: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
};

const carColorsA = {
  ETH: '#ffa726',
  JF:  '#60a5fa',
  LEW: '#c084fc',
};

// Circular gauge (180° arc) — odometer readout
function DashGauge({ km = 128, max = 500, amount = 32.00, color = dashA.amber }) {
  const r = 110, cx = 140, cy = 140;
  const pct = Math.min(1, km / max);
  const angle = -180 + pct * 180;
  const rad = (angle * Math.PI) / 180;
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy + r * Math.sin(rad);
  const large = pct > 0.5 ? 1 : 0;
  return (
    <div style={{ position: 'relative', width: 280, height: 160, margin: '0 auto' }}>
      <svg width="280" height="160" viewBox="0 0 280 160">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" x2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.2"/>
            <stop offset="1" stopColor={color}/>
          </linearGradient>
        </defs>
        {/* tick marks */}
        {Array.from({ length: 21 }).map((_, i) => {
          const a = -180 + (i / 20) * 180;
          const ar = (a * Math.PI) / 180;
          const x1 = cx + (r - 12) * Math.cos(ar);
          const y1 = cy + (r - 12) * Math.sin(ar);
          const xo = cx + r * Math.cos(ar);
          const yo = cy + r * Math.sin(ar);
          const lit = i / 20 <= pct;
          return <line key={i} x1={x1} y1={y1} x2={xo} y2={yo}
            stroke={lit ? color : dashA.border} strokeWidth={i % 5 === 0 ? 2 : 1}/>;
        })}
        {/* arc bg */}
        <path d={`M 30 140 A ${r} ${r} 0 1 1 250 140`}
          fill="none" stroke={dashA.border} strokeWidth="2" opacity="0.4"/>
        {/* arc lit */}
        <path d={`M 30 140 A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
          fill="none" stroke="url(#gaugeGrad)" strokeWidth="3" strokeLinecap="round"/>
        {/* needle */}
        <line x1={cx} y1={cy} x2={cx + (r - 20) * Math.cos(rad)} y2={cy + (r - 20) * Math.sin(rad)}
          stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="7" fill={dashA.bg} stroke={color} strokeWidth="2"/>
      </svg>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center',
      }}>
        <div style={{
          fontFamily: dashA.fontDisplay, fontSize: 44, fontWeight: 500,
          color: dashA.text, letterSpacing: -1, lineHeight: 1,
        }}>{km}<span style={{ fontSize: 16, color: dashA.textDim, marginLeft: 4 }}>km</span></div>
        <div style={{
          fontFamily: dashA.fontDisplay, fontSize: 13, color,
          marginTop: 4, letterSpacing: 1,
        }}>€ {amount.toFixed(2)}</div>
      </div>
    </div>
  );
}

// Pill-style car selector — instrument cluster buttons
function CarPillsA({ value = 'ETH' }) {
  const cars = [
    { id: 'ETH', name: 'Ethel' },
    { id: 'JF',  name: 'Jean-F.' },
    { id: 'LEW', name: 'Lewis' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {cars.map(c => {
        const active = c.id === value;
        return (
          <div key={c.id} style={{
            flex: 1, padding: '12px 10px',
            borderRadius: 10,
            background: active ? dashA.bgElev : 'transparent',
            border: `1px solid ${active ? carColorsA[c.id] : dashA.border}`,
            textAlign: 'center',
            boxShadow: active ? `0 0 0 3px ${carColorsA[c.id]}22, inset 0 0 20px ${carColorsA[c.id]}18` : 'none',
          }}>
            <div style={{
              fontFamily: dashA.fontDisplay, fontSize: 11,
              color: active ? carColorsA[c.id] : dashA.textMute,
              letterSpacing: 2, fontWeight: 600,
            }}>{c.id}</div>
            <div style={{
              fontSize: 12, color: active ? dashA.text : dashA.textDim,
              marginTop: 2,
            }}>{c.name}</div>
          </div>
        );
      })}
    </div>
  );
}

function OdoField({ label, value, hint, color = dashA.amber }) {
  return (
    <div style={{
      background: dashA.bgCard, borderRadius: 12, padding: '14px 16px',
      border: `1px solid ${dashA.border}`, flex: 1,
    }}>
      <div style={{
        fontSize: 10, color: dashA.textMute, letterSpacing: 1.5,
        fontFamily: dashA.fontDisplay, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: dashA.fontDisplay, fontSize: 24, fontWeight: 500,
        color: dashA.text, marginTop: 4, letterSpacing: -0.5,
      }}>{value.toLocaleString('nl-BE')}</div>
      {hint && <div style={{ fontSize: 11, color, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ───── Screen 1: New Trip ─────
function ScreenA_Trip() {
  return (
    <div style={{ background: dashA.bg, minHeight: '100%', paddingBottom: 100 }}>
      {/* custom header */}
      <div style={{ padding: '60px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: dashA.bgCard,
            border: `1px solid ${dashA.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L4 7l5 5" stroke={dashA.textDim} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
          </div>
          <div style={{
            fontFamily: dashA.fontDisplay, fontSize: 10, color: dashA.textMute,
            letterSpacing: 2, textTransform: 'uppercase',
          }}>Nieuwe rit</div>
          <div style={{ width: 36 }} />
        </div>
      </div>

      {/* gauge */}
      <div style={{ padding: '12px 0 24px' }}>
        <DashGauge km={128} max={500} amount={25.60} />
        <div style={{
          textAlign: 'center', fontSize: 11, color: dashA.textMute,
          letterSpacing: 2, fontFamily: dashA.fontDisplay, marginTop: -4,
        }}>AFSTAND · BEDRAG</div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* car */}
        <div>
          <div style={{
            fontSize: 10, color: dashA.textMute, letterSpacing: 2,
            fontFamily: dashA.fontDisplay, marginBottom: 8,
          }}>WAGEN</div>
          <CarPillsA value="ETH" />
        </div>

        {/* odometer fields */}
        <div>
          <div style={{
            fontSize: 10, color: dashA.textMute, letterSpacing: 2,
            fontFamily: dashA.fontDisplay, marginBottom: 8,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>KILOMETERSTAND</span>
            <span style={{ color: dashA.amber }}>↓ SCROLL</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <OdoField label="START" value={47212} />
            <OdoField label="EIND" value={47340} hint="+128 km" color={dashA.amber}/>
          </div>
        </div>

        {/* person */}
        <div style={{
          background: dashA.bgCard, borderRadius: 12, padding: '14px 16px',
          border: `1px solid ${dashA.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: `linear-gradient(135deg, ${dashA.amber}, ${dashA.amberDim})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 700, fontSize: 14,
          }}>RD</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, color: dashA.textMute, letterSpacing: 2,
              fontFamily: dashA.fontDisplay,
            }}>BESTUURDER</div>
            <div style={{ fontSize: 15, color: dashA.text, marginTop: 2 }}>Roeland De Meester</div>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={dashA.textMute} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
        </div>

        {/* location mini-map */}
        <div style={{
          background: dashA.bgCard, borderRadius: 12,
          border: `1px solid ${dashA.border}`, overflow: 'hidden',
        }}>
          <div style={{
            height: 100, position: 'relative',
            background: `
              radial-gradient(circle at 30% 40%, ${dashA.amber}22 0 20%, transparent 40%),
              linear-gradient(135deg, #1a2030 0%, #0f1420 100%)
            `,
          }}>
            {/* stylized roads */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <path d="M 0 60 Q 80 40, 160 70 T 320 50" stroke={dashA.textMute} strokeWidth="1.5" fill="none" opacity="0.5"/>
              <path d="M 40 0 L 60 100" stroke={dashA.textMute} strokeWidth="1" fill="none" opacity="0.3"/>
              <path d="M 180 0 L 200 100" stroke={dashA.textMute} strokeWidth="1" fill="none" opacity="0.3"/>
              <circle cx="30%" cy="40%" r="8" fill={dashA.amber}/>
              <circle cx="30%" cy="40%" r="14" fill="none" stroke={dashA.amber} strokeWidth="1" opacity="0.5"/>
            </svg>
            <div style={{
              position: 'absolute', bottom: 10, left: 12,
              fontFamily: dashA.fontDisplay, fontSize: 11, color: dashA.amber,
            }}>51.0536° N · 3.7253° E</div>
          </div>
        </div>
      </div>

      {/* submit bar */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 50,
        display: 'flex', gap: 10,
      }}>
        <div style={{
          flex: 1, padding: '16px', borderRadius: 14,
          background: `linear-gradient(180deg, ${dashA.amber}, ${dashA.amberDim})`,
          textAlign: 'center', fontWeight: 600, fontSize: 15, color: '#000',
          boxShadow: `0 8px 24px ${dashA.amber}44, inset 0 1px 0 rgba(255,255,255,0.3)`,
          letterSpacing: 0.3,
        }}>Rit opslaan · €25,60</div>
      </div>
    </div>
  );
}

// ───── Screen 2: Fuel ─────
function ScreenA_Fuel() {
  return (
    <div style={{ background: dashA.bg, minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '60px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: dashA.bgCard,
          border: `1px solid ${dashA.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L4 7l5 5" stroke={dashA.textDim} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
        </div>
        <div style={{
          fontFamily: dashA.fontDisplay, fontSize: 10, color: dashA.textMute,
          letterSpacing: 2, textTransform: 'uppercase',
        }}>Tanken</div>
        <div style={{ width: 36 }} />
      </div>

      {/* fuel-pump hero */}
      <div style={{ position: 'relative', height: 200, margin: '0 20px', marginBottom: 20 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: dashA.bgCard, borderRadius: 16,
          border: `1px solid ${dashA.border}`,
          overflow: 'hidden',
        }}>
          {/* fluid fill viz */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: '68%',
            background: `linear-gradient(180deg, ${dashA.amber}44, ${dashA.amberDim}88)`,
          }}/>
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '32%', height: 2,
            background: dashA.amber, opacity: 0.8,
            boxShadow: `0 0 10px ${dashA.amber}`,
          }}/>
          <div style={{
            position: 'absolute', top: 20, left: 20,
            fontFamily: dashA.fontDisplay, fontSize: 10, color: dashA.textMute,
            letterSpacing: 2,
          }}>VOLUME</div>
          <div style={{
            position: 'absolute', top: 36, left: 20,
            fontFamily: dashA.fontDisplay, fontSize: 42, color: dashA.text,
            fontWeight: 500, letterSpacing: -1, lineHeight: 1,
          }}>38,2<span style={{ fontSize: 18, color: dashA.textDim, marginLeft: 6 }}>L</span></div>
          <div style={{
            position: 'absolute', bottom: 20, right: 20, textAlign: 'right',
          }}>
            <div style={{
              fontFamily: dashA.fontDisplay, fontSize: 10, color: dashA.amber,
              letterSpacing: 2,
            }}>PRIJS / L</div>
            <div style={{
              fontFamily: dashA.fontDisplay, fontSize: 22, color: dashA.text,
              fontWeight: 500,
            }}>€ 1,742</div>
          </div>
          <div style={{
            position: 'absolute', bottom: 20, left: 20,
            fontFamily: dashA.fontDisplay, fontSize: 10, color: dashA.textMute,
            letterSpacing: 2,
          }}>TOTAAL<br/>
          <span style={{ fontSize: 22, color: dashA.text, letterSpacing: -0.5 }}>€ 66,55</span></div>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{
            fontSize: 10, color: dashA.textMute, letterSpacing: 2,
            fontFamily: dashA.fontDisplay, marginBottom: 8,
          }}>WAGEN</div>
          <CarPillsA value="ETH" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <OdoField label="BEDRAG €" value={66.55} />
          <OdoField label="LITER" value={38.2} hint="€1,742/L" />
        </div>

        {/* receipt upload */}
        <div style={{
          background: dashA.bgCard, borderRadius: 12, padding: '14px 16px',
          border: `1px dashed ${dashA.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: dashA.bgElev,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="5" width="18" height="14" rx="2" stroke={dashA.amber} strokeWidth="1.5"/>
              <circle cx="11" cy="12" r="3.5" stroke={dashA.amber} strokeWidth="1.5"/>
              <path d="M7 5l1.5-2h5L15 5" stroke={dashA.amber} strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: dashA.text, fontWeight: 500 }}>Bonnetje scannen</div>
            <div style={{ fontSize: 12, color: dashA.textDim, marginTop: 2 }}>
              Bedrag + liters worden automatisch ingevuld
            </div>
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 11,
            background: dashA.amber, color: '#000', fontWeight: 600,
            letterSpacing: 0.5,
          }}>SCAN</div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 50,
      }}>
        <div style={{
          padding: '16px', borderRadius: 14,
          background: `linear-gradient(180deg, ${dashA.amber}, ${dashA.amberDim})`,
          textAlign: 'center', fontWeight: 600, fontSize: 15, color: '#000',
          boxShadow: `0 8px 24px ${dashA.amber}44`,
        }}>Tankbeurt opslaan</div>
      </div>
    </div>
  );
}

// ───── Screen 3: Reservation ─────
function ScreenA_Reserve() {
  const days = ['ma','di','wo','do','vr','za','zo'];
  const selected = [3, 4, 5]; // Thu Fri Sat
  return (
    <div style={{ background: dashA.bg, minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '60px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: dashA.bgCard,
          border: `1px solid ${dashA.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L4 7l5 5" stroke={dashA.textDim} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
        </div>
        <div style={{
          fontFamily: dashA.fontDisplay, fontSize: 10, color: dashA.textMute,
          letterSpacing: 2, textTransform: 'uppercase',
        }}>Reservering</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* big date range display */}
        <div style={{
          background: dashA.bgCard, borderRadius: 16, padding: 20,
          border: `1px solid ${dashA.border}`,
        }}>
          <div style={{
            fontSize: 10, color: dashA.textMute, letterSpacing: 2,
            fontFamily: dashA.fontDisplay,
          }}>VAN · TOT</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8,
          }}>
            <div>
              <div style={{
                fontFamily: dashA.fontDisplay, fontSize: 36,
                color: dashA.text, fontWeight: 500, letterSpacing: -1, lineHeight: 1,
              }}>18</div>
              <div style={{ fontSize: 12, color: dashA.textDim, marginTop: 2 }}>don · apr</div>
            </div>
            <div style={{
              flex: 1, height: 2, background: `linear-gradient(90deg, ${dashA.amber}, ${dashA.amberDim})`,
              borderRadius: 2, margin: '0 8px', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                fontSize: 10, color: dashA.amber, whiteSpace: 'nowrap',
                fontFamily: dashA.fontDisplay, letterSpacing: 1,
                background: dashA.bgCard, padding: '0 8px',
              }}>3 DAGEN</div>
            </div>
            <div>
              <div style={{
                fontFamily: dashA.fontDisplay, fontSize: 36,
                color: dashA.text, fontWeight: 500, letterSpacing: -1, lineHeight: 1,
              }}>20</div>
              <div style={{ fontSize: 12, color: dashA.textDim, marginTop: 2 }}>zat · apr</div>
            </div>
          </div>
        </div>

        {/* mini-calendar */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 10,
          }}>
            <div style={{ color: dashA.text, fontSize: 15, fontWeight: 500 }}>April 2026</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: dashA.bgCard,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${dashA.border}`,
              }}>
                <svg width="8" height="10" viewBox="0 0 8 10"><path d="M6 1L2 5l4 4" stroke={dashA.textDim} strokeWidth="1.5" fill="none"/></svg>
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: dashA.bgCard,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${dashA.border}`,
              }}>
                <svg width="8" height="10" viewBox="0 0 8 10"><path d="M2 1l4 4-4 4" stroke={dashA.textDim} strokeWidth="1.5" fill="none"/></svg>
              </div>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
            marginBottom: 6,
          }}>
            {days.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 10, color: dashA.textMute,
                letterSpacing: 1, fontFamily: dashA.fontDisplay, textTransform: 'uppercase',
              }}>{d}</div>
            ))}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
          }}>
            {Array.from({ length: 21 }).map((_, i) => {
              const day = i - 1;
              const isSel = selected.includes(i - 15);
              const isBooked = [1, 2, 10].includes(i);
              const isStart = i - 15 === 3;
              const isEnd = i - 15 === 5;
              return (
                <div key={i} style={{
                  height: 36, borderRadius: isSel ? (isStart ? '8px 0 0 8px' : isEnd ? '0 8px 8px 0' : 0) : 6,
                  background: isSel ? `${dashA.amber}22` : 'transparent',
                  border: isSel ? `1px solid ${dashA.amber}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: dashA.fontDisplay, fontSize: 13,
                  color: isBooked ? dashA.textMute : isSel ? dashA.amber : dashA.text,
                  textDecoration: isBooked ? 'line-through' : 'none',
                  opacity: day < 1 ? 0.2 : 1,
                }}>{day > 0 ? day : ''}</div>
              );
            })}
          </div>
        </div>

        {/* availability */}
        <div style={{
          background: dashA.bgCard, borderRadius: 12, padding: '14px 16px',
          border: `1px solid ${dashA.green}44`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4, background: dashA.green,
            boxShadow: `0 0 8px ${dashA.green}`,
          }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: dashA.text, fontWeight: 500 }}>Ethel is vrij op deze dagen</div>
            <div style={{ fontSize: 11, color: dashA.textDim, marginTop: 2 }}>Geen andere reserveringen</div>
          </div>
        </div>

        <CarPillsA value="ETH" />
      </div>

      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 50,
      }}>
        <div style={{
          padding: '16px', borderRadius: 14,
          background: `linear-gradient(180deg, ${dashA.amber}, ${dashA.amberDim})`,
          textAlign: 'center', fontWeight: 600, fontSize: 15, color: '#000',
          boxShadow: `0 8px 24px ${dashA.amber}44`,
        }}>Reservering bevestigen</div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenA_Trip, ScreenA_Fuel, ScreenA_Reserve });
