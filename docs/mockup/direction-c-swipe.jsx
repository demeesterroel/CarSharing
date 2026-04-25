// Direction C — "Swipe to Share"
// Playful, modern, card-based. Bold color per car (ETH/JF/LEW get their
// own identity). Progress rings, bottom-sheet flows, gestures.

const swipeC = {
  bg: '#f6f7fb',
  bgCard: '#ffffff',
  ink: '#0b0f1a',
  inkDim: '#5c6478',
  inkMute: '#9aa1b3',
  line: '#eceff7',
  // accents
  mint: '#b6e8c9',
  lime: '#d9f05a',
  sky:  '#b9d9ff',
  peach:'#ffd1b5',
  lavender: '#d9c8ff',
  coral: '#ff6b5b',
  ink2: '#0b0f1a',
  fontBody: '"Inter", -apple-system, system-ui, sans-serif',
  fontDisplay: '"Instrument Serif", "Playfair Display", Georgia, serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
};

const carColorsC = {
  ETH: { bg: '#d9f05a', ink: '#1a3210', emoji: 'E' },
  JF:  { bg: '#b9d9ff', ink: '#0a2147', emoji: 'J' },
  LEW: { bg: '#ffd1b5', ink: '#4a1e00', emoji: 'L' },
};

function CarChipsC({ value = 'ETH' }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {['ETH','JF','LEW'].map(c => {
        const active = c === value;
        const col = carColorsC[c];
        return (
          <div key={c} style={{
            flex: 1, height: 72, borderRadius: 18,
            background: active ? col.bg : swipeC.bgCard,
            border: active ? 'none' : `1.5px solid ${swipeC.line}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: active ? `0 8px 20px ${col.bg}99` : 'none',
            transform: active ? 'scale(1.03)' : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: active ? col.ink : swipeC.line,
              color: active ? col.bg : swipeC.inkMute,
              fontFamily: swipeC.fontDisplay, fontSize: 20, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 4,
            }}>{col.emoji}</div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              color: active ? col.ink : swipeC.inkMute,
            }}>{c}</div>
          </div>
        );
      })}
    </div>
  );
}

// Scroll-wheel odometer — big numbers with adjacent dim ghosts
function OdoWheel({ value, label, diff }) {
  const d = String(value).padStart(6, '0').split('');
  return (
    <div style={{
      background: swipeC.bgCard, borderRadius: 22, padding: '16px 18px',
      border: `1px solid ${swipeC.line}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, color: swipeC.inkDim, fontWeight: 500 }}>{label}</div>
        {diff && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: swipeC.ink,
            background: swipeC.lime, padding: '3px 8px', borderRadius: 8,
          }}>{diff}</div>
        )}
      </div>
      <div style={{
        display: 'flex', gap: 2, fontFamily: swipeC.fontMono,
        fontSize: 32, fontWeight: 600, letterSpacing: 1,
        color: swipeC.ink, lineHeight: 1,
      }}>
        {d.map((n, i) => (
          <div key={i} style={{
            width: 24, textAlign: 'center',
            color: i < d.length - 3 && n === '0' ? swipeC.inkMute : swipeC.ink,
          }}>{n}</div>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 14, color: swipeC.inkMute, alignSelf: 'flex-end' }}>km</div>
      </div>
    </div>
  );
}

// Progress ring — for fuel / km / etc
function Ring({ pct = 0.6, size = 120, stroke = 10, color = swipeC.coral, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={swipeC.line} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>{children}</div>
    </div>
  );
}

// ───── Screen 1: Trip ─────
function ScreenC_Trip() {
  return (
    <div style={{
      background: swipeC.bg, minHeight: '100%',
      paddingBottom: 100,
    }}>
      {/* header */}
      <div style={{
        padding: '62px 20px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: swipeC.bgCard,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke={swipeC.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: swipeC.ink }}>Nieuwe rit</div>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: swipeC.bgCard,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: swipeC.ink, fontWeight: 300,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>✕</div>
      </div>

      {/* hero card — huge display of cost */}
      <div style={{
        margin: '0 16px 16px', borderRadius: 28, padding: '20px 22px 24px',
        background: carColorsC.ETH.bg, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ fontSize: 12, color: carColorsC.ETH.ink, opacity: 0.6, fontWeight: 600, letterSpacing: 0.5 }}>
          JE RIT VAN VANDAAG
        </div>
        <div style={{
          fontFamily: swipeC.fontDisplay, fontSize: 72, fontWeight: 500,
          color: carColorsC.ETH.ink, lineHeight: 1, letterSpacing: -2,
          marginTop: 6,
        }}>€19<span style={{ fontSize: 36, fontWeight: 400 }}>,20</span></div>
        <div style={{
          display: 'flex', gap: 10, marginTop: 8, alignItems: 'center',
        }}>
          <div style={{
            padding: '4px 10px', borderRadius: 12, background: 'rgba(0,0,0,0.08)',
            fontSize: 11, fontWeight: 600, color: carColorsC.ETH.ink,
          }}>128 km</div>
          <div style={{ fontSize: 12, color: carColorsC.ETH.ink, opacity: 0.7 }}>
            € 0,20/km · na 25% korting
          </div>
        </div>
        {/* decorative squiggle */}
        <svg width="100" height="40" viewBox="0 0 100 40" style={{
          position: 'absolute', right: -10, top: 16,
        }}>
          <path d="M 0 20 Q 20 0, 40 20 T 80 20 T 120 20" stroke={carColorsC.ETH.ink} strokeWidth="2" fill="none" opacity="0.25"/>
        </svg>
      </div>

      {/* car + driver, joined */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: swipeC.inkDim, marginBottom: 8, padding: '0 4px' }}>
          Met welke wagen?
        </div>
        <CarChipsC value="ETH"/>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: swipeC.inkDim, marginBottom: 8, padding: '0 4px' }}>
          Wie rijdt?
        </div>
        <div style={{
          background: swipeC.bgCard, borderRadius: 18, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${swipeC.line}`,
        }}>
          {/* horiz avatar scroller */}
          {['RD','LV','FD','JP','+'].map((a, i) => (
            <div key={i} style={{
              width: 40, height: 40, borderRadius: 20, flexShrink: 0,
              background: i === 0 ? swipeC.ink : i === 4 ? swipeC.bg : ['#d9f05a','#b9d9ff','#ffd1b5','#d9c8ff'][i - 1],
              color: i === 0 ? '#fff' : swipeC.ink,
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: i === 0 ? `2.5px solid ${swipeC.lime}` : i === 4 ? `1.5px dashed ${swipeC.inkMute}` : 'none',
              color: i === 4 ? swipeC.inkMute : undefined,
            }}>{a}</div>
          ))}
        </div>
      </div>

      {/* odometer */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: swipeC.inkDim, marginBottom: 8, padding: '0 4px' }}>
          Kilometerstand — swipe om te wijzigen
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <OdoWheel value={47212} label="Start"/>
          <OdoWheel value={47340} label="Eind" diff="+128 km"/>
        </div>
      </div>

      {/* location */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: swipeC.bgCard, borderRadius: 18, padding: '14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${swipeC.line}`,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: swipeC.mint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z" stroke={swipeC.ink} strokeWidth="1.8" fill="none"/><circle cx="10" cy="8" r="2" fill={swipeC.ink}/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: swipeC.ink }}>Brugge, Grote Markt</div>
            <div style={{ fontSize: 12, color: swipeC.inkDim, marginTop: 2 }}>Huidige locatie · tik om te wijzigen</div>
          </div>
        </div>
      </div>

      {/* swipe-to-submit */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 46,
        background: swipeC.ink, borderRadius: 30, padding: 5,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 25, background: swipeC.lime,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9h12M11 5l4 4-4 4" stroke={swipeC.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{
          flex: 1, textAlign: 'center', color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
        }}>Veeg om rit op te slaan</div>
      </div>
    </div>
  );
}

// ───── Screen 2: Fuel ─────
function ScreenC_Fuel() {
  return (
    <div style={{
      background: swipeC.bg, minHeight: '100%', paddingBottom: 100,
    }}>
      <div style={{
        padding: '62px 20px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: swipeC.bgCard,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke={swipeC.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: swipeC.ink }}>Tankbeurt</div>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: swipeC.bgCard,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: swipeC.ink,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>✕</div>
      </div>

      {/* receipt capture card */}
      <div style={{
        margin: '0 16px 16px', borderRadius: 28,
        background: swipeC.bgCard, padding: 20,
        border: `1px solid ${swipeC.line}`,
        display: 'flex', gap: 16, alignItems: 'center',
      }}>
        <Ring pct={1} size={100} stroke={10} color={swipeC.coral}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="3" width="20" height="22" rx="1.5" stroke={swipeC.ink} strokeWidth="2"/>
            <path d="M8 8h12M8 12h12M8 16h8" stroke={swipeC.ink} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="22" cy="22" r="5" fill={swipeC.lime} stroke={swipeC.ink} strokeWidth="1.5"/>
            <path d="M20 22l1.5 1.5L24 21" stroke={swipeC.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Ring>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: swipeC.coral, letterSpacing: 1 }}>
            BONNETJE GESCAND
          </div>
          <div style={{
            fontFamily: swipeC.fontDisplay, fontSize: 24, fontWeight: 500,
            color: swipeC.ink, lineHeight: 1.1, marginTop: 4,
          }}>Alles klopt?</div>
          <div style={{ fontSize: 12, color: swipeC.inkDim, marginTop: 3 }}>
            Tik om opnieuw te scannen
          </div>
        </div>
      </div>

      {/* big numbers — 2 up */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{
          flex: 1, background: swipeC.lavender, borderRadius: 22,
          padding: 18, position: 'relative',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: swipeC.ink, opacity: 0.6 }}>BEDRAG</div>
          <div style={{
            fontFamily: swipeC.fontDisplay, fontSize: 42, fontWeight: 500,
            color: swipeC.ink, lineHeight: 1, marginTop: 4, letterSpacing: -1,
          }}>€66<span style={{ fontSize: 24 }}>,55</span></div>
        </div>
        <div style={{
          flex: 1, background: swipeC.mint, borderRadius: 22,
          padding: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: swipeC.ink, opacity: 0.6 }}>LITERS</div>
          <div style={{
            fontFamily: swipeC.fontDisplay, fontSize: 42, fontWeight: 500,
            color: swipeC.ink, lineHeight: 1, marginTop: 4, letterSpacing: -1,
          }}>38<span style={{ fontSize: 24 }}>,2</span></div>
        </div>
      </div>

      {/* derived price chip */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{
          background: swipeC.bgCard, borderRadius: 18, padding: '14px',
          display: 'flex', alignItems: 'center', gap: 10,
          border: `1px solid ${swipeC.line}`,
        }}>
          <div style={{
            padding: '4px 10px', borderRadius: 10, background: swipeC.lime,
            fontSize: 12, fontWeight: 700, color: swipeC.ink,
          }}>€ 1,742/L</div>
          <div style={{ fontSize: 12, color: swipeC.inkDim }}>
            berekend uit bedrag ÷ liters
          </div>
        </div>
      </div>

      {/* car */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: swipeC.inkDim, marginBottom: 8, padding: '0 4px' }}>
          Welke wagen?
        </div>
        <CarChipsC value="LEW"/>
      </div>

      {/* driver */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: swipeC.bgCard, borderRadius: 18,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${swipeC.line}`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20, background: swipeC.peach,
            color: swipeC.ink, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>LV</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: swipeC.ink }}>Lotte V.</div>
            <div style={{ fontSize: 12, color: swipeC.inkDim, marginTop: 2 }}>Jij hebt betaald · +€66,55 op jouw rekening</div>
          </div>
        </div>
      </div>

      {/* swipe-to-submit */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 46,
        background: swipeC.ink, borderRadius: 30, padding: 5,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 25, background: swipeC.coral,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9h12M11 5l4 4-4 4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{
          flex: 1, textAlign: 'center', color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
        }}>Veeg om bon te bewaren</div>
      </div>
    </div>
  );
}

// ───── Screen 3: Reservation ─────
function ScreenC_Reserve() {
  const days = ['M','D','W','D','V','Z','Z'];
  return (
    <div style={{
      background: swipeC.bg, minHeight: '100%', paddingBottom: 100,
    }}>
      <div style={{
        padding: '62px 20px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: swipeC.bgCard,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke={swipeC.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: swipeC.ink }}>Reserveren</div>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: swipeC.bgCard,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: swipeC.ink,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>✕</div>
      </div>

      {/* playful hero */}
      <div style={{
        margin: '0 16px 16px', borderRadius: 28, padding: '22px 22px',
        background: carColorsC.JF.bg, position: 'relative',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: carColorsC.JF.ink, opacity: 0.65, letterSpacing: 1 }}>
          JEAN-FRANCOIS WACHT
        </div>
        <div style={{
          fontFamily: swipeC.fontDisplay, fontSize: 34, fontWeight: 500,
          color: carColorsC.JF.ink, lineHeight: 1.05, marginTop: 6, letterSpacing: -0.8,
        }}>3 dagen<br/>weekend aan zee</div>
        <div style={{
          display: 'flex', gap: 8, marginTop: 10, alignItems: 'center',
        }}>
          <div style={{
            padding: '5px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.5)',
            fontSize: 12, fontWeight: 600, color: carColorsC.JF.ink,
          }}>18 → 20 apr</div>
          <div style={{
            padding: '5px 10px', borderRadius: 10, background: carColorsC.JF.ink,
            fontSize: 12, fontWeight: 600, color: carColorsC.JF.bg,
          }}>✓ Vrij</div>
        </div>
      </div>

      {/* car picker */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: swipeC.inkDim, marginBottom: 8, padding: '0 4px' }}>
          Welke wagen?
        </div>
        <CarChipsC value="JF"/>
      </div>

      {/* mini calendar grid */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{
          background: swipeC.bgCard, borderRadius: 22, padding: 16,
          border: `1px solid ${swipeC.line}`,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: swipeC.ink }}>April 2026</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['‹','›'].map((c, i) => (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: 14, background: swipeC.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: swipeC.inkDim, fontSize: 14,
                }}>{c}</div>
              ))}
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
            marginBottom: 4,
          }}>
            {days.map((d, i) => (
              <div key={i} style={{
                textAlign: 'center', fontSize: 10, fontWeight: 600,
                color: swipeC.inkMute, padding: '4px 0',
              }}>{d}</div>
            ))}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
          }}>
            {Array.from({ length: 35 }).map((_, i) => {
              const d = i - 2;
              const inMonth = d >= 1 && d <= 30;
              const selStart = d === 18, selEnd = d === 20, selMid = d === 19;
              const sel = selStart || selEnd || selMid;
              const booked = [6, 7, 14].includes(d);
              return (
                <div key={i} style={{
                  aspectRatio: '1', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selMid && <div style={{
                    position: 'absolute', inset: '4px -1px', background: carColorsC.JF.bg,
                  }}/>}
                  {selStart && <div style={{
                    position: 'absolute', top: 4, bottom: 4, left: '50%', right: -1,
                    background: carColorsC.JF.bg,
                  }}/>}
                  {selEnd && <div style={{
                    position: 'absolute', top: 4, bottom: 4, left: -1, right: '50%',
                    background: carColorsC.JF.bg,
                  }}/>}
                  <div style={{
                    position: 'relative', width: 30, height: 30, borderRadius: 15,
                    background: (selStart || selEnd) ? carColorsC.JF.ink : 'transparent',
                    color: sel ? (selMid ? carColorsC.JF.ink : carColorsC.JF.bg) : booked ? swipeC.inkMute : inMonth ? swipeC.ink : swipeC.inkMute,
                    fontSize: 12, fontWeight: sel ? 700 : 500,
                    textDecoration: booked ? 'line-through' : 'none',
                    opacity: inMonth ? 1 : 0.3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{inMonth ? d : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* driver */}
      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div style={{
          background: swipeC.bgCard, borderRadius: 18, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${swipeC.line}`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20, background: swipeC.lavender,
            color: swipeC.ink, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>FD</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: swipeC.ink }}>Femke D.M.</div>
            <div style={{ fontSize: 12, color: swipeC.inkDim, marginTop: 2 }}>Bestuurder</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 2l5 5-5 5" stroke={swipeC.inkMute} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* note */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: swipeC.bgCard, borderRadius: 18, padding: '14px',
          border: `1px solid ${swipeC.line}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: swipeC.inkDim, letterSpacing: 0.5, marginBottom: 4 }}>
            REDEN (OPTIONEEL)
          </div>
          <div style={{
            fontFamily: swipeC.fontDisplay, fontSize: 18, color: swipeC.ink,
            fontStyle: 'italic',
          }}>Weekend aan de kust</div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 46,
        background: swipeC.ink, borderRadius: 30, padding: 5,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 25, background: carColorsC.JF.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9h12M11 5l4 4-4 4" stroke={carColorsC.JF.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{
          flex: 1, textAlign: 'center', color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
        }}>Veeg om te reserveren</div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenC_Trip, ScreenC_Fuel, ScreenC_Reserve });
