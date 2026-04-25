// Direction B — "Receipt / Paper"
// Editorial, thermal-receipt metaphor. Warm cream paper, black ink,
// mono + serif. Honest, transparent, democratic — matches the brand ethos.

const paperB = {
  paper: '#f5f0e6',
  paperDeep: '#ebe3d2',
  ink: '#1a1a1a',
  inkDim: '#555047',
  inkMute: '#8a8273',
  rule: '#1a1a1a',
  accent: '#c44536',  // stamp red
  green: '#5a7a3c',
  fontMono: '"Courier Prime", "IBM Plex Mono", ui-monospace, monospace',
  fontSerif: '"Fraunces", "Playfair Display", Georgia, serif',
  fontSans: '"Inter", -apple-system, system-ui, sans-serif',
};

// Dashed horizontal rule like a perforation
function Perf({ margin = '12px 0' }) {
  return <div style={{
    height: 1, borderTop: `1.5px dashed ${paperB.ink}`,
    margin,
  }}/>;
}

function ReceiptRow({ label, value, big, accent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontFamily: paperB.fontMono,
      fontSize: big ? 16 : 13,
      padding: '4px 0',
      color: accent ? paperB.accent : paperB.ink,
    }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: big ? 11 : 10, color: paperB.inkDim }}>{label}</span>
      <span style={{ fontWeight: big ? 700 : 500 }}>{value}</span>
    </div>
  );
}

// Stamp — hand-drawn looking
function Stamp({ children, rotate = -6, color = paperB.accent }) {
  return (
    <div style={{
      display: 'inline-block',
      padding: '6px 14px',
      border: `2.5px solid ${color}`,
      borderRadius: 4,
      color,
      fontFamily: paperB.fontMono,
      fontSize: 11, fontWeight: 700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      transform: `rotate(${rotate}deg)`,
      opacity: 0.88,
    }}>{children}</div>
  );
}

function CarStampsB({ value }) {
  const cars = ['ETH', 'JF', 'LEW'];
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {cars.map((c, i) => {
        const active = c === value;
        return (
          <div key={c} style={{
            flex: 1, padding: '10px 6px', textAlign: 'center',
            border: `1.5px ${active ? 'solid' : 'dashed'} ${paperB.ink}`,
            background: active ? paperB.ink : 'transparent',
            color: active ? paperB.paper : paperB.ink,
            fontFamily: paperB.fontMono, fontSize: 13, fontWeight: 700,
            letterSpacing: 2,
            transform: active ? `rotate(${(i - 1) * 1.5}deg)` : 'none',
          }}>{c}</div>
        );
      })}
    </div>
  );
}

function InputLineB({ label, value, placeholder, suffix, underlined = true }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
      }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        borderBottom: underlined ? `1.5px solid ${paperB.ink}` : 'none',
        paddingBottom: 4,
      }}>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 22, color: paperB.ink,
          flex: 1, fontWeight: 500,
        }}>{value || <span style={{ color: paperB.inkMute, fontStyle: 'italic' }}>{placeholder}</span>}</div>
        {suffix && <div style={{ fontFamily: paperB.fontMono, fontSize: 13, color: paperB.inkDim }}>{suffix}</div>}
      </div>
    </div>
  );
}

// Receipt-edge decoration — scalloped top
function ReceiptTear({ top = true }) {
  const tri = 'polygon(0 0, 8px 100%, 16px 0)';
  return (
    <div style={{
      height: 10, display: 'flex',
      [top ? 'marginTop' : 'marginBottom']: top ? -10 : -10,
      transform: top ? 'none' : 'rotate(180deg)',
    }}>
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} style={{
          width: 16, height: 10, background: paperB.paper,
          clipPath: tri,
        }}/>
      ))}
    </div>
  );
}

// ───── Screen 1: Trip ─────
function ScreenB_Trip() {
  return (
    <div style={{
      background: paperB.paperDeep,
      minHeight: '100%', padding: '60px 16px 100px',
    }}>
      {/* receipt body */}
      <div style={{
        background: paperB.paper, padding: '24px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.04)',
        position: 'relative',
      }}>
        {/* header */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
            color: paperB.ink, letterSpacing: -0.5,
          }}>Autodelen</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginTop: 2,
          }}>Coöperatieve · Gent</div>
        </div>
        <Perf/>

        {/* section: trip */}
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
          letterSpacing: 2, textTransform: 'uppercase',
          textAlign: 'center', fontWeight: 700, marginBottom: 12,
        }}>— Nieuwe rit —</div>

        <div style={{
          fontFamily: paperB.fontMono, fontSize: 11, color: paperB.inkDim,
          marginBottom: 14, textAlign: 'center',
        }}>Do · 18 apr 2026 · 14:32</div>

        {/* car */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
          }}>Wagen</div>
          <CarStampsB value="ETH"/>
        </div>

        {/* driver */}
        <InputLineB label="Bestuurder" value="Roeland D.M."/>

        {/* odometer */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <InputLineB label="Start km" value="47 212"/>
          </div>
          <div style={{ flex: 1 }}>
            <InputLineB label="Eind km" value="47 340"/>
          </div>
        </div>

        <Perf/>

        {/* totals */}
        <ReceiptRow label="Afstand" value="128 km"/>
        <ReceiptRow label="Tarief" value="€ 0,20 / km"/>
        <ReceiptRow label="Korting" value="- 25%"/>
        <Perf margin="8px 0"/>
        <ReceiptRow label="Totaal" value="€ 19,20" big accent/>

        <Perf/>

        {/* location */}
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
        }}>Bestemming</div>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 16, color: paperB.ink,
          fontStyle: 'italic', marginBottom: 6,
        }}>“Brugge — de Grote Markt”</div>
        <div style={{
          border: `1.5px solid ${paperB.ink}`, height: 80,
          position: 'relative', overflow: 'hidden',
          background: `
            repeating-linear-gradient(45deg, ${paperB.paperDeep} 0 2px, transparent 2px 8px),
            ${paperB.paper}
          `,
        }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <path d="M 10 50 Q 60 20, 120 40 T 250 30" stroke={paperB.ink} strokeWidth="1.2" fill="none" strokeDasharray="3 2"/>
            <circle cx="15%" cy="55%" r="4" fill={paperB.accent}/>
            <circle cx="85%" cy="35%" r="4" fill={paperB.accent}/>
          </svg>
        </div>

        <Perf/>

        {/* stamp */}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Stamp>Eerlijk gedeeld</Stamp>
        </div>

        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          textAlign: 'center', marginTop: 10,
        }}>≋ Veeg omlaag om op te slaan ≋</div>
      </div>

      {/* submit */}
      <div style={{
        marginTop: 20, padding: '16px',
        background: paperB.ink, color: paperB.paper,
        fontFamily: paperB.fontMono, fontSize: 13, fontWeight: 700,
        letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase',
      }}>Rit afstempelen →</div>
    </div>
  );
}

// ───── Screen 2: Fuel ─────
function ScreenB_Fuel() {
  return (
    <div style={{
      background: paperB.paperDeep,
      minHeight: '100%', padding: '60px 16px 100px',
    }}>
      <div style={{
        background: paperB.paper, padding: '24px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
            color: paperB.ink, letterSpacing: -0.5,
          }}>Tankbon</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginTop: 2,
          }}>— bewijs van brandstof —</div>
        </div>
        <Perf/>

        {/* receipt photo slot */}
        <div style={{
          border: `1.5px dashed ${paperB.ink}`,
          padding: 14, display: 'flex', gap: 12, alignItems: 'center',
          marginBottom: 14,
        }}>
          <div style={{
            width: 64, height: 80,
            background: `
              repeating-linear-gradient(0deg, ${paperB.paperDeep} 0 2px, ${paperB.paper} 2px 5px)
            `,
            border: `1px solid ${paperB.ink}`,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%) rotate(-10deg)',
              width: 30, height: 8,
              background: 'rgba(232, 210, 150, 0.7)',
              border: `1px dashed ${paperB.inkDim}`,
            }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 16, color: paperB.ink,
              fontWeight: 600,
            }}>Kleef je bonnetje</div>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 11, color: paperB.inkDim,
              marginTop: 2,
            }}>Tik om te scannen. We lezen<br/>bedrag &amp; liters automatisch.</div>
          </div>
        </div>

        {/* car */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
          }}>Wagen</div>
          <CarStampsB value="LEW"/>
        </div>

        <InputLineB label="Betaald door" value="Lotte V."/>
        <InputLineB label="Datum" value="14 april 2026"/>

        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <InputLineB label="Bedrag" value="66,55" suffix="€"/>
          </div>
          <div style={{ flex: 1 }}>
            <InputLineB label="Liters" value="38,20" suffix="L"/>
          </div>
        </div>

        <Perf/>

        <ReceiptRow label="Prijs per liter" value="€ 1,742"/>
        <ReceiptRow label="Kilometerstand" value="47 212 km"/>
        <Perf margin="8px 0"/>
        <ReceiptRow label="Bijdrage aan kas" value="€ 66,55" big accent/>

        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 12, fontStyle: 'italic',
          color: paperB.inkDim, textAlign: 'center', margin: '14px 0 6px',
          lineHeight: 1.5,
        }}>
          “Het geld dat je tankt staat op<br/>
          jouw rekening — iedereen deelt eerlijk.”
        </div>

        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <Stamp rotate={4} color={paperB.green}>In de kas</Stamp>
        </div>
      </div>

      <div style={{
        marginTop: 20, padding: '16px',
        background: paperB.ink, color: paperB.paper,
        fontFamily: paperB.fontMono, fontSize: 13, fontWeight: 700,
        letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase',
      }}>Tankbon bewaren →</div>
    </div>
  );
}

// ───── Screen 3: Reservation ─────
function ScreenB_Reserve() {
  return (
    <div style={{
      background: paperB.paperDeep,
      minHeight: '100%', padding: '60px 16px 100px',
    }}>
      <div style={{
        background: paperB.paper, padding: '24px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 30, fontWeight: 700,
            color: paperB.ink, letterSpacing: -0.5,
          }}>Reserveren</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginTop: 2,
          }}>— leg een wagen vast —</div>
        </div>
        <Perf/>

        {/* car stamps */}
        <CarStampsB value="JF"/>

        {/* date range as a torn ticket */}
        <div style={{
          margin: '18px 0 10px',
          background: paperB.paperDeep,
          padding: '16px 14px',
          position: 'relative',
          border: `1.5px solid ${paperB.ink}`,
        }}>
          {/* punched holes */}
          <div style={{
            position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 12, borderRadius: 6,
            background: paperB.paper, border: `1.5px solid ${paperB.ink}`,
          }}/>
          <div style={{
            position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 12, borderRadius: 6,
            background: paperB.paper, border: `1.5px solid ${paperB.ink}`,
          }}/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                letterSpacing: 2,
              }}>VAN</div>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 28, color: paperB.ink,
                fontWeight: 700, lineHeight: 1, marginTop: 2,
              }}>18 apr</div>
              <div style={{ fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim, marginTop: 2 }}>donderdag</div>
            </div>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 18, color: paperB.accent,
              letterSpacing: 2, fontWeight: 700,
            }}>→</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                letterSpacing: 2,
              }}>TOT</div>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 28, color: paperB.ink,
                fontWeight: 700, lineHeight: 1, marginTop: 2,
              }}>20 apr</div>
              <div style={{ fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim, marginTop: 2 }}>zaterdag</div>
            </div>
          </div>
          <Perf margin="10px 0"/>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
            textAlign: 'center', letterSpacing: 1.5,
          }}>3 DAGEN · 2 NACHTEN</div>
        </div>

        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
        }}>Week van 13 apr</div>

        {/* horizontal week strip */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['ma 13','di 14','wo 15','do 16','vr 17','za 18','zo 19'].map((d, i) => {
            const booked = i === 0 || i === 1;
            const sel = i >= 5;
            return (
              <div key={i} style={{
                flex: 1,
                padding: '8px 4px', textAlign: 'center',
                border: `1.5px solid ${sel ? paperB.accent : paperB.ink}`,
                background: sel ? paperB.accent : booked ? paperB.paperDeep : paperB.paper,
                color: sel ? paperB.paper : booked ? paperB.inkMute : paperB.ink,
                fontFamily: paperB.fontMono, fontSize: 10,
                textDecoration: booked ? 'line-through' : 'none',
                fontWeight: sel ? 700 : 500,
              }}>{d.split(' ')[1]}<br/>
                <span style={{ fontSize: 8, opacity: 0.7 }}>{d.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        <Perf/>

        <InputLineB label="Bestuurder" value="Femke DM."/>
        <InputLineB label="Reden (optioneel)" value="weekend kust" underlined={false}/>

        <div style={{ textAlign: 'center', padding: '8px 0', marginTop: 6 }}>
          <Stamp rotate={-3} color={paperB.green}>Beschikbaar</Stamp>
        </div>
      </div>

      <div style={{
        marginTop: 20, padding: '16px',
        background: paperB.ink, color: paperB.paper,
        fontFamily: paperB.fontMono, fontSize: 13, fontWeight: 700,
        letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase',
      }}>Reservering vastleggen →</div>
    </div>
  );
}

Object.assign(window, { ScreenB_Trip, ScreenB_Fuel, ScreenB_Reserve });
