// Admin module part 2: Cars (with km-price helper — 2 variants),
// Settlement, Owner payout (2 variants), and the AdminPage shell.

// ═══════════ Cars — list + km-price assistant ═══════════
function AdminCars({ lang }) {
  const t = strings[lang];
  const { role, caps } = useRole();
  const isOwner = role === 'owner';

  const [carsDraft, setCarsDraft] = React.useState(() => CARS.map(c => ({ ...c, fixedCosts: (c.fixedCosts||[]).map(fc=>({...fc})) })));
  const [helperVariant, setHelperVariant] = React.useState('story'); // 'story' | 'calc'

  const visibleCars = isOwner ? carsDraft.filter(c => caps.ownedCars.includes(c.short)) : carsDraft;
  const [selected, setSelected] = React.useState(() =>
    isOwner && caps.ownedCars.length > 0 ? caps.ownedCars[0] : CARS[0].short
  );

  // If role switches to owner while a non-owned car is selected, reset
  React.useEffect(() => {
    if (isOwner && caps.ownedCars.length > 0 && !caps.ownedCars.includes(selected)) {
      setSelected(caps.ownedCars[0]);
    }
  }, [role]);

  const car = carsDraft.find(c => c.short === selected);
  const setCar = (patch) => setCarsDraft(cs => cs.map(c => c.short === selected ? { ...c, ...patch } : c));

  return (
    <div>
      <AdminSectionTitle>{t.beheerCars}</AdminSectionTitle>

      {/* Car selector */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        {visibleCars.map(c => (
          <button key={c.short} onClick={() => setSelected(c.short)} style={{
            flex: 1, padding: '12px 8px',
            border: `1.5px ${c.short === selected ? 'solid' : 'dashed'} ${paperB.ink}`,
            background: c.short === selected ? paperB.ink : paperB.paper,
            color: c.short === selected ? paperB.paper : paperB.ink,
            cursor: 'pointer', fontFamily: paperB.fontMono, fontWeight: 700,
            transform: c.short === selected ? 'rotate(-1deg)' : 'none',
            transition: 'transform 0.15s',
          }}>
            <div style={{ fontSize: 14, letterSpacing: 2 }}>{c.short}</div>
            <div style={{ fontSize: 9, marginTop: 3, opacity: 0.75, letterSpacing: 0.5 }}>{c.merk}</div>
          </button>
        ))}
      </div>

      {/* Editable car card */}
      <div style={{ padding: '0 16px' }}>
        <AdminCard>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <CarStamp code={car.short} active/>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
                color: paperB.ink, lineHeight: 1,
              }}>{car.name}</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
                letterSpacing: 1, marginTop: 2,
              }}>{car.merk} · {car.kleur} · {lang === 'nl' ? 'eigenaar' : 'owner'} {car.eigenaar}</div>
            </div>
          </div>

          {/* Km price + long threshold */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            <NumberField label={t.kmPrice} value={car.prijs} step="0.01" suffix="€/km"
              onChange={v => setCar({ prijs: v })}/>
            <NumberField label={t.longThreshold} value={car.longKm} step="50" suffix="km"
              onChange={v => setCar({ longKm: v })}/>
          </div>

          {/* Fixed costs line-item editor */}
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
          }}>{t.fixedYearCosts}</div>
          <FixedCostEditor
            items={car.fixedCosts || []}
            onChange={fc => setCar({ fixedCosts: fc })}
            lang={lang}
          />

        </AdminCard>
      </div>

      {/* Km-price helper — 2 variants toggle */}
      <div style={{
        padding: '0 16px 12px',
        display: 'flex', gap: 8,
      }}>
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
          ? <KmPriceHelperStory car={car} lang={lang}/>
          : <KmPriceHelperCalc car={car} lang={lang}/>}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step, suffix }) {
  return (
    <div>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3,
      }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        borderBottom: `1.5px solid ${paperB.ink}`, paddingBottom: 2,
      }}>
        <input type="number" step={step || 'any'} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            flex: 1, fontFamily: paperB.fontSerif, fontSize: 18,
            color: paperB.ink, fontWeight: 600, background: 'transparent',
            border: 'none', outline: 'none', padding: 0, minWidth: 0,
          }}/>
        {suffix && <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          marginLeft: 6,
        }}>{suffix}</div>}
      </div>
    </div>
  );
}

// ── Variant A: STORY — narrative breakdown with "broek scheuren" framing
function KmPriceHelperStory({ car, lang }) {
  const t = strings[lang];
  const s = suggestedKmPrice(car);
  const a = carYearAggregates(car);
  const [scenario, setScenario] = React.useState(car.prijs);

  // scenario calc
  const scenarioRevenue = scenario * (car.jaarKm);
  const totalCost = a.fuelPaid + a.expPaid + a.vasteTotal;
  const scenarioDelta = scenarioRevenue - totalCost;
  const scheurt = scenarioDelta < 0;

  return (
    <AdminCard>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
      }}>— {t.kmPriceHelper} —</div>

      {/* The "story": what did last year actually cost */}
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink,
        lineHeight: 1.55, marginBottom: 14,
      }}>
        {lang === 'nl' ? (
          <>Vorig jaar reed <b>{car.name}</b> <b>{car.jaarKm.toLocaleString('nl-BE')} km</b>.
          Dat kostte de co-op in totaal <b>{fmtMoney(totalCost)}</b> — dus <b>{fmtMoney(totalCost/car.jaarKm)}/km</b> aan echte kosten.</>
        ) : (
          <>Last year <b>{car.name}</b> drove <b>{car.jaarKm.toLocaleString('nl-BE')} km</b>.
          Total cost was <b>{fmtMoney(totalCost)}</b> — that's <b>{fmtMoney(totalCost/car.jaarKm)}/km</b> real cost.</>
        )}
      </div>

      {/* Breakdown rows */}
      <div style={{
        background: paperB.paperDeep, padding: '12px 14px', marginBottom: 14,
      }}>
        {(() => {
          const catColors = { verzekeringen: paperB.blue, belastingen: paperB.ink, onderhoud: paperB.amber, keuring: paperB.green, diversen: paperB.inkDim };
          const catTotals = (car.fixedCosts||[]).reduce((acc,fc)=>{ acc[fc.category]=(acc[fc.category]||0)+fc.amount; return acc; },{});
          const fixedRows = Object.entries(catTotals).map(([cat,yr])=>({
            l: FIXED_COST_LABELS[cat]?.[lang]||cat, v: s.breakdown[cat]||0, yr, c: catColors[cat]||paperB.inkDim,
          }));
          return [
            { l: t.brandstof,    v: s.breakdown.brandstof, yr: a.fuelPaid,  c: paperB.accent },
            { l: t.onderhoudBkd, v: s.breakdown.onderhoud,  yr: a.expPaid,  c: paperB.amber  },
            ...fixedRows,
          ];
        })().map((row, i, arr) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: paperB.fontMono, fontSize: 11, padding: '3px 0',
            borderBottom: i < arr.length - 1 ? `1px dotted ${paperB.paperDark}` : 'none',
          }}>
            <span style={{ color: paperB.inkDim, letterSpacing: 1 }}>{row.l}</span>
            <span>
              <span style={{ color: paperB.inkMute, marginRight: 10 }}>{fmtMoney(row.yr)}</span>
              <span style={{ color: row.c, fontWeight: 700 }}>{fmtMoney(row.v).replace('€ ','€ ')}/km</span>
            </span>
          </div>
        ))}
        <Perf margin="8px 0 6px"/>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: paperB.fontMono, fontWeight: 700,
        }}>
          <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: paperB.ink }}>= {t.costPrice}</span>
          <span style={{ fontSize: 16, color: paperB.ink }}>{fmtMoney(s.kostprijs)}/km</span>
        </div>
      </div>

      {/* Scenario slider */}
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
      }}>{t.scenarioSlider}</div>
      <div style={{
        background: paperB.paper, padding: '12px 0',
        border: `1.5px dashed ${paperB.ink}`,
      }}>
        <div style={{ padding: '0 16px' }}>
          <input type="range" min="0.10" max="0.50" step="0.01" value={scenario}
            onChange={e => setScenario(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: paperB.ink }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute, marginTop: -2 }}>
            <span>€ 0,10</span>
            <span>€ 0,50</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '4px 0 0' }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 34, fontWeight: 700,
            color: paperB.ink, lineHeight: 1,
          }}>€ {scenario.toFixed(2).replace('.', ',')}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginTop: 2,
          }}>per km</div>
        </div>

        <Perf margin="12px 0 10px"/>
        <div style={{ padding: '0 16px' }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 14, lineHeight: 1.55, color: paperB.ink,
          }}>
            {lang === 'nl' ? (scheurt ? (
              <>Met <b>€ {scenario.toFixed(2).replace('.',',')}/km</b> komen we <b style={{color: paperB.accent}}>
              {fmtMoney(Math.abs(scenarioDelta))} tekort</b> op een jaar.
              De eigenaar ({car.eigenaar}) legt zelf bij.</>
            ) : (
              <>Met <b>€ {scenario.toFixed(2).replace('.',',')}/km</b> houdt de co-op <b style={{color: paperB.green}}>
              {fmtMoney(scenarioDelta)} over</b> na een jaar. Ademruimte voor onverwachte kosten.</>
            )) : (scheurt ? (
              <>At <b>€ {scenario.toFixed(2).replace('.',',')}/km</b> we're <b style={{color: paperB.accent}}>
              {fmtMoney(Math.abs(scenarioDelta))} short</b> over a year. Owner ({car.eigenaar}) subsidises.</>
            ) : (
              <>At <b>€ {scenario.toFixed(2).replace('.',',')}/km</b> the co-op gets <b style={{color: paperB.green}}>
              {fmtMoney(scenarioDelta)} surplus</b> over a year.</>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <Stamp rotate={-3} color={scheurt ? paperB.accent : paperB.green}>
            {scheurt ? t.broekScheurenWarn : t.broekScheuren}
          </Stamp>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <AdminButton>✓ {lang === 'nl' ? `Zet km-prijs op € ${scenario.toFixed(2).replace('.',',')}` : `Set km rate to € ${scenario.toFixed(2).replace('.',',')}`}</AdminButton>
      </div>
    </AdminCard>
  );
}

// ── Variant B: CALC — compact calculator-style with side-by-side comparison
function KmPriceHelperCalc({ car, lang }) {
  const t = strings[lang];
  const s = suggestedKmPrice(car);
  const a = carYearAggregates(car);
  const [scenario, setScenario] = React.useState(car.prijs);

  const scenarioRevenue = scenario * car.jaarKm;
  const totalCost = a.fuelPaid + a.expPaid + a.vasteTotal;
  const scenarioDelta = scenarioRevenue - totalCost;

  return (
    <AdminCard>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
      }}>— {t.kmPriceHelper} · {lang === 'nl' ? 'Rekenmachine' : 'Calculator'} —</div>

      {/* 3-column comparison: cost / current / scenario */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
        background: paperB.ink, border: `1.5px solid ${paperB.ink}`, marginBottom: 14,
      }}>
        {[
          { l: t.costPrice,    v: s.kostprijs,    c: paperB.accent },
          { l: t.currentPrice, v: car.prijs,      c: paperB.ink },
          { l: lang === 'nl' ? 'Scenario' : 'Scenario', v: scenario, c: paperB.blue },
        ].map((col, i) => (
          <div key={i} style={{
            background: paperB.paper, padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 8, color: paperB.inkDim,
              letterSpacing: 1.5, textTransform: 'uppercase',
            }}>{col.l}</div>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 22, fontWeight: 700,
              color: col.c, lineHeight: 1.1, marginTop: 4,
            }}>€ {col.v.toFixed(2).replace('.', ',')}</div>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 8, color: paperB.inkMute,
              letterSpacing: 1, marginTop: 2,
            }}>/ km</div>
          </div>
        ))}
      </div>

      {/* Breakdown as compact list */}
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
      }}>{t.breakdown} ({car.jaarKm.toLocaleString('nl-BE')} km)</div>

      {(() => {
        const catTotals = (car.fixedCosts||[]).reduce((acc,fc)=>{ acc[fc.category]=(acc[fc.category]||0)+fc.amount; return acc; },{});
        const fixedRows = Object.entries(catTotals).map(([cat,yr])=>({
          l: FIXED_COST_LABELS[cat]?.[lang]||cat, v: s.breakdown[cat]||0, yr,
        }));
        return [
          { l: t.brandstof,    v: s.breakdown.brandstof, yr: a.fuelPaid },
          { l: t.onderhoudBkd, v: s.breakdown.onderhoud,  yr: a.expPaid },
          ...fixedRows,
        ];
      })().map((row, i) => (
        <MiniBar key={i} label={row.l} valPerKm={row.v} valTotal={row.yr} maxPerKm={s.kostprijs}/>
      ))}

      {/* Scenario slider */}
      <div style={{
        marginTop: 14, background: paperB.paperDeep, padding: '12px 14px',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase',
          }}>{t.scenarioSlider}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 12, fontWeight: 700,
            color: paperB.blue,
          }}>€ {scenario.toFixed(2).replace('.', ',')}/km</div>
        </div>
        <input type="range" min="0.10" max="0.50" step="0.01" value={scenario}
          onChange={e => setScenario(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: paperB.blue }}/>

        <Perf margin="10px 0 8px"/>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: paperB.fontMono, fontSize: 11,
        }}>
          <span style={{ color: paperB.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>
            {scenarioDelta >= 0 ? t.suggestionSurplus : t.suggestionShortfall}
          </span>
          <span style={{
            color: scenarioDelta >= 0 ? paperB.green : paperB.accent,
            fontWeight: 700, fontSize: 14,
          }}>
            {scenarioDelta >= 0 ? '+ ' : '− '}{fmtMoney(Math.abs(scenarioDelta))}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <AdminButton>✓ {lang === 'nl' ? `Zet op € ${scenario.toFixed(2).replace('.',',')}/km` : `Apply € ${scenario.toFixed(2).replace('.',',')}/km`}</AdminButton>
      </div>
    </AdminCard>
  );
}

function MiniBar({ label, valPerKm, valTotal, maxPerKm }) {
  const pct = Math.max(5, (valPerKm / maxPerKm) * 100);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4,
    }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 1, minWidth: 90, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        flex: 1, height: 12, background: paperB.paperDeep, position: 'relative',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`, background: paperB.ink,
        }}/>
      </div>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.ink,
        minWidth: 70, textAlign: 'right', fontWeight: 600,
      }}>{fmtMoney(valPerKm)}/km</div>
    </div>
  );
}

// ═══════════ Settlement ═══════════
function AdminSettlement({ lang }) {
  const t = strings[lang];
  const [generated, setGenerated] = React.useState(false);
  const rows = yearlySettlement();
  const credits = rows.filter(r => r.balance > 0).reduce((s,r) => s + r.balance, 0);
  const debits = rows.filter(r => r.balance < 0).reduce((s,r) => s + r.balance, 0);

  return (
    <div>
      <AdminSectionTitle right={`2026 · ${PEOPLE.length} ${lang === 'nl' ? 'leden' : 'members'}`}>
        {t.settlement}
      </AdminSectionTitle>

      <div style={{ padding: '0 16px' }}>
        {/* Summary card */}
        <AdminCard>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.ink,
            fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5,
          }}>
            {t.settlementMath}
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <AdminNumber label={t.totalCredits} value={'+ ' + fmtMoney(credits)} color={paperB.green}/>
            <AdminNumber label={t.totalDebits}  value={fmtMoney(debits)}         color={paperB.accent}/>
          </div>
          <Perf margin="14px 0 8px"/>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{
              fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
              textTransform: 'uppercase', color: paperB.inkDim,
            }}>Σ · {t.mustBalance}</span>
            <span style={{
              fontFamily: paperB.fontSerif, fontSize: 18, fontWeight: 700,
              color: Math.abs(credits + debits) < 0.01 ? paperB.green : paperB.accent,
            }}>{fmtMoney(credits + debits)}</span>
          </div>

          {!generated && (
            <div style={{ marginTop: 14 }}>
              <AdminButton onClick={() => setGenerated(true)}>
                ▶ {t.runSettlement}
              </AdminButton>
            </div>
          )}
        </AdminCard>

        {generated && (
          <>
            <AdminSectionTitle right={`${rows.length} ${lang === 'nl' ? 'regels' : 'rows'}`}>
              {lang === 'nl' ? 'Per lid' : 'Per member'}
            </AdminSectionTitle>
            {rows.map(r => <SettlementRow key={r.name} row={r} lang={lang}/>)}

            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AdminButton size="sm">↓ {t.exportCsv}</AdminButton>
              <AdminButton size="sm" variant="ghost">↓ {t.exportPdf}</AdminButton>
              <AdminButton size="sm" variant="ghost">⎘ {t.copyInstructions}</AdminButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SettlementRow({ row, lang }) {
  const t = strings[lang];
  const [expanded, setExpanded] = React.useState(false);
  const credit = row.balance > 0;
  const zero = Math.abs(row.balance) < 0.01;
  const color = zero ? paperB.inkDim : credit ? paperB.green : paperB.accent;

  return (
    <div style={{
      background: paperB.paper, marginBottom: 6, padding: '12px 14px',
      borderLeft: `3px solid ${color}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      cursor: 'pointer',
    }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34,
          background: paperB.ink, color: paperB.paper,
          fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{row.name.slice(0,2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 700,
            color: paperB.ink, lineHeight: 1.1,
          }}>{row.name}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1, marginTop: 2, textTransform: 'uppercase',
          }}>{zero ? t.paysZero : credit ? t.payBack : t.toPay}</div>
        </div>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
          color, whiteSpace: 'nowrap',
        }}>
          {zero ? '€ 0,00' : (credit ? '+ ' : '− ') + fmtMoney(Math.abs(row.balance))}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, animation: 'popIn 0.15s ease-out' }}>
          <Perf/>
          <div style={{ padding: '4px 0 2px' }}>
            <ReceiptRow label={lang === 'nl' ? 'Ritten (te betalen)' : 'Trips (charge)'}
              value={'− ' + fmtMoney(row.tripCost)}/>
            <ReceiptRow label={lang === 'nl' ? 'Voorgeschoten brandstof' : 'Fuel advanced'}
              value={'+ ' + fmtMoney(row.paidFuel)}/>
            <ReceiptRow label={lang === 'nl' ? 'Voorgeschoten onderhoud' : 'Maintenance advanced'}
              value={'+ ' + fmtMoney(row.paidExp)}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════ Owner payout ═══════════
function AdminPayout({ lang }) {
  const t = strings[lang];
  const [variant, setVariant] = React.useState('instructions'); // 'instructions' | 'table'

  // Aggregate per car, then group by owner
  const perCar = CARS.map(c => ({
    car: c, ...carYearAggregates(c),
  }));
  const byOwner = {};
  for (const row of perCar) {
    const o = row.car.eigenaar;
    byOwner[o] = byOwner[o] || { owner: o, rows: [], total: 0 };
    byOwner[o].rows.push(row);
    byOwner[o].total += row.ownerNet;
  }
  const owners = Object.values(byOwner);

  return (
    <div>
      <AdminSectionTitle>{t.payouts}</AdminSectionTitle>

      <div style={{
        padding: '0 16px 12px', fontFamily: paperB.fontSerif, fontSize: 13,
        color: paperB.inkDim, fontStyle: 'italic', lineHeight: 1.5,
      }}>{t.payoutSub}. {t.coopFairness}</div>

      {/* Variant toggle */}
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
        {[
          { k: 'instructions', l: lang === 'nl' ? 'Betaalinstructies' : 'Payment notes' },
          { k: 'table',        l: lang === 'nl' ? 'Tabel' : 'Table' },
        ].map(v => {
          const sel = v.k === variant;
          return (
            <button key={v.k} onClick={() => setVariant(v.k)} style={{
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
        {variant === 'instructions'
          ? <PayoutInstructions owners={owners} lang={lang}/>
          : <PayoutTable owners={owners} lang={lang}/>}
      </div>
    </div>
  );
}

// ── Variant A: Instructions — "Roeland receives €X; Malvina receives €Y"
function PayoutInstructions({ owners, lang }) {
  const t = strings[lang];
  return (
    <>
      {/* Hero: the clear, human summary */}
      <AdminCard>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center',
        }}>— {lang === 'nl' ? 'Betaalinstructies' : 'Payment instructions'} —</div>
        {owners.map(o => (
          <div key={o.owner} style={{
            padding: '14px 0',
            borderTop: `1.5px dashed ${paperB.paperDark}`,
          }}>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 20, color: paperB.ink,
              lineHeight: 1.4, fontWeight: 500,
            }}>
              <b>{o.owner}</b>{' '}
              {o.total >= 0
                ? (lang === 'nl' ? 'ontvangt ' : 'receives ')
                : (lang === 'nl' ? 'moet terugstorten ' : 'must return ')}
              <span style={{
                color: o.total >= 0 ? paperB.green : paperB.accent, fontWeight: 700,
              }}>{fmtMoney(Math.abs(o.total))}</span>
              {lang === 'nl' ? ' van de coöperatie' : ' to the co-op'}.
            </div>
          </div>
        ))}

        <Perf margin="14px 0 8px"/>
        <div style={{ display: 'flex', gap: 8 }}>
          <AdminButton size="sm">⎘ {lang === 'nl' ? 'Kopieer' : 'Copy'}</AdminButton>
          <AdminButton size="sm" variant="ghost">✉ {lang === 'nl' ? 'Mail naar eigenaars' : 'Email owners'}</AdminButton>
        </div>
      </AdminCard>

      {/* Per-car detail */}
      <AdminSectionTitle>{lang === 'nl' ? 'Detail per wagen' : 'Detail per car'}</AdminSectionTitle>
      {owners.flatMap(o => o.rows).map(row => (
        <CarPayoutCard key={row.car.short} row={row} lang={lang}/>
      ))}
    </>
  );
}

// ── Variant B: Table — all numbers in one grid
function PayoutTable({ owners, lang }) {
  const t = strings[lang];
  const rows = owners.flatMap(o => o.rows);

  return (
    <>
      <AdminCard pad="0">
        <div style={{
          background: paperB.ink, color: paperB.paper,
          padding: '10px 14px', display: 'grid',
          gridTemplateColumns: '40px 1fr 1fr',
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5,
          textTransform: 'uppercase', fontWeight: 700,
        }}>
          <span></span>
          <span>{lang === 'nl' ? 'Wagen / eigenaar' : 'Car / owner'}</span>
          <span style={{ textAlign: 'right' }}>{t.ownerNet}</span>
        </div>
        {rows.map(row => (
          <TableRow key={row.car.short} row={row} lang={lang}/>
        ))}

        {/* totals per owner */}
        <div style={{
          borderTop: `1.5px solid ${paperB.ink}`, padding: '12px 14px',
          background: paperB.paperDeep,
        }}>
          {owners.map(o => (
            <div key={o.owner} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '4px 0',
            }}>
              <span style={{
                fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
                letterSpacing: 1.5, textTransform: 'uppercase', color: paperB.ink,
              }}>Σ {o.owner}</span>
              <span style={{
                fontFamily: paperB.fontSerif, fontSize: 18, fontWeight: 700,
                color: o.total >= 0 ? paperB.green : paperB.accent,
              }}>{(o.total >= 0 ? '+ ' : '− ') + fmtMoney(Math.abs(o.total))}</span>
            </div>
          ))}
        </div>
      </AdminCard>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <AdminButton size="sm">↓ {t.exportCsv}</AdminButton>
        <AdminButton size="sm" variant="ghost">↓ {t.exportPdf}</AdminButton>
      </div>
    </>
  );
}

function TableRow({ row, lang }) {
  const [open, setOpen] = React.useState(false);
  const t = strings[lang];

  return (
    <>
      <div onClick={() => setOpen(o => !o)} style={{
        padding: '10px 14px', display: 'grid',
        gridTemplateColumns: '40px 1fr 1fr',
        borderBottom: `1px solid ${paperB.paperDark}`,
        cursor: 'pointer', alignItems: 'center',
      }}>
        <CarStamp code={row.car.short} active size="sm"/>
        <div>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 14, fontWeight: 700, color: paperB.ink,
          }}>{row.car.name}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim, letterSpacing: 1,
          }}>{row.car.eigenaar}</div>
        </div>
        <div style={{
          textAlign: 'right',
          fontFamily: paperB.fontSerif, fontSize: 16, fontWeight: 700,
          color: row.ownerNet >= 0 ? paperB.green : paperB.accent,
        }}>{(row.ownerNet >= 0 ? '+ ' : '− ') + fmtMoney(Math.abs(row.ownerNet))}</div>
      </div>
      {open && (
        <div style={{
          padding: '8px 14px 12px', background: paperB.paperDeep,
          animation: 'popIn 0.15s ease-out',
          borderBottom: `1px solid ${paperB.paperDark}`,
        }}>
          <ReceiptRow label={`+ ${t.carRevenue}`}     value={'+ ' + fmtMoney(row.tripRevenue)}/>
          <ReceiptRow label={`− ${t.carFuel}`}        value={'− ' + fmtMoney(row.fuelPaid)}/>
          <ReceiptRow label={`− ${t.carMaint}`}       value={'− ' + fmtMoney(row.expPaid)}/>
          <ReceiptRow label={`− ${t.carFixed}`}       value={'− ' + fmtMoney(row.vasteTotal)}/>
          <Perf margin="6px 0"/>
          <ReceiptRow label={`= ${t.ownerNet}`}       value={fmtMoney(row.ownerNet)} big/>
        </div>
      )}
    </>
  );
}

function CarPayoutCard({ row, lang }) {
  const t = strings[lang];
  return (
    <AdminCard stripe={row.ownerNet >= 0 ? paperB.green : paperB.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <CarStamp code={row.car.short} active/>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 17, fontWeight: 700, color: paperB.ink,
          }}>{row.car.name}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim, letterSpacing: 1,
          }}>→ {row.car.eigenaar}</div>
        </div>
      </div>
      <ReceiptRow label={`+ ${t.carRevenue}`}  value={'+ ' + fmtMoney(row.tripRevenue)}/>
      <ReceiptRow label={`− ${t.carFuel}`}     value={'− ' + fmtMoney(row.fuelPaid)}/>
      <ReceiptRow label={`− ${t.carMaint}`}    value={'− ' + fmtMoney(row.expPaid)}/>
      <ReceiptRow label={`− ${t.carFixed}`}    value={'− ' + fmtMoney(row.vasteTotal)}/>
      <Perf margin="6px 0"/>
      <ReceiptRow label={`= ${t.ownerNet}`}
        value={(row.ownerNet >= 0 ? '+ ' : '− ') + fmtMoney(Math.abs(row.ownerNet))}
        big color={row.ownerNet >= 0 ? paperB.green : paperB.accent}/>
    </AdminCard>
  );
}

// ═══════════ Admin shell ═══════════
// ── Admin Payments — simple list of settlement payments
function AdminPayments({ lang }) {
  const MOCK_PAYMENTS = [
    { id: 'p1', from: 'Stefaan',  to: 'co-op',    amount: 156.40, date: '2026-01-15', note: lang === 'nl' ? 'Afrekening 2025' : 'Settlement 2025' },
    { id: 'p2', from: 'Susanna',  to: 'co-op',    amount:  89.20, date: '2026-01-18', note: lang === 'nl' ? 'Afrekening 2025' : 'Settlement 2025' },
    { id: 'p3', from: 'co-op',   to: 'Malvina',   amount:  43.00, date: '2026-01-22', note: lang === 'nl' ? 'Terugbetaling 2025' : 'Refund 2025' },
    { id: 'p4', from: 'Tinne',    to: 'co-op',    amount:  22.80, date: '2026-01-25', note: lang === 'nl' ? 'Afrekening 2025' : 'Settlement 2025' },
    { id: 'p5', from: 'Armando',  to: 'co-op',    amount:  61.50, date: '2026-01-28', note: lang === 'nl' ? 'Afrekening 2025' : 'Settlement 2025' },
  ];
  const [payments, setPayments] = React.useState(MOCK_PAYMENTS);

  return (
    <div>
      <AdminSectionTitle right={`${payments.length} ${lang === 'nl' ? 'betalingen' : 'payments'}`}>
        {lang === 'nl' ? 'Betalingen' : 'Payments'}
      </AdminSectionTitle>
      <div style={{ padding: '0 16px' }}>
        {payments.map(p => (
          <AdminCard key={p.id} stripe={p.from === 'co-op' ? paperB.accent : paperB.green}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 700, color: paperB.ink }}>
                  {p.from} → {p.to}
                </div>
                <div style={{
                  fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                  letterSpacing: 1, marginTop: 3, textTransform: 'uppercase',
                }}>{fmtDate(p.date, lang)} · {p.note}</div>
              </div>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
                color: p.from === 'co-op' ? paperB.accent : paperB.green,
                whiteSpace: 'nowrap',
              }}>{fmtMoney(p.amount)}</div>
            </div>
          </AdminCard>
        ))}
        <AdminButton onClick={() => {}} variant="ghost">
          + {lang === 'nl' ? 'Betaling registreren' : 'Register payment'}
        </AdminButton>
      </div>
    </div>
  );
}

function AdminPage({ lang, setLang }) {
  const t = strings[lang];
  const { role, caps } = useRole();
  const [adminTab, setAdminTab] = React.useState(() => localStorage.getItem('cs-admin-tab') || 'inbox');
  const [fleetDetail, setFleetDetail] = React.useState(null);

  React.useEffect(() => { localStorage.setItem('cs-admin-tab', adminTab); }, [adminTab]);

  // If user loses access to an admin-only tab, reset to inbox
  React.useEffect(() => {
    const adminOnlyTabs = ['members','settle','wagens','personen','betalingen'];
    if (!caps.isAdmin && adminOnlyTabs.includes(adminTab)) setAdminTab('inbox');
  }, [caps.isAdmin]);

  React.useEffect(() => { if (adminTab !== 'fleet') setFleetDetail(null); }, [adminTab]);

  const detailCar = fleetDetail ? carByShort[fleetDetail] : null;
  const stampLabel = caps.isAdmin ? 'ADMIN' : (lang === 'nl' ? 'EIGENAAR' : 'OWNER');

  return (
    <div style={{ background: paperB.paperDeep, minHeight: '100%', paddingBottom: 120 }}>
      <div style={{
        background: paperB.paper, padding: '20px 20px 18px',
        borderBottom: `1.5px dashed ${paperB.ink}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase',
          }}>{t.beheerSub}</div>
          <LangToggle lang={lang} setLang={setLang}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
            color: paperB.ink, letterSpacing: -0.5, lineHeight: 1.05,
          }}>{t.beheer}</div>
          <Stamp rotate={-4} color={caps.isAdmin ? paperB.blue : paperB.amber} size="sm">
            {stampLabel}
          </Stamp>
        </div>
      </div>

      <AdminTabs tab={adminTab} setTab={setAdminTab} lang={lang}/>

      {adminTab === 'fleet'      && !detailCar && <AdminFleet lang={lang} onOpenCar={setFleetDetail}/>}
      {adminTab === 'fleet'      &&  detailCar && <BreakEvenDetail car={detailCar} lang={lang} onBack={() => setFleetDetail(null)}/>}
      {adminTab === 'inbox'      && <AdminInbox lang={lang}/>}
      {adminTab === 'hygiene'    && <AdminHygiene lang={lang}/>}
      {adminTab === 'members'    && <AdminMembers lang={lang}/>}
      {adminTab === 'settle'     && <AdminSettlement lang={lang}/>}
      {adminTab === 'payout'     && <NarratedPayout lang={lang}/>}
      {adminTab === 'wagens'     && <AdminCars lang={lang}/>}
      {adminTab === 'personen'   && <AdminMembers lang={lang}/>}
      {adminTab === 'betalingen' && <AdminPayments lang={lang}/>}
    </div>
  );
}

Object.assign(window, {
  AdminCars, NumberField, KmPriceHelperStory, KmPriceHelperCalc, MiniBar,
  AdminSettlement, SettlementRow,
  AdminPayout, PayoutInstructions, PayoutTable, TableRow, CarPayoutCard,
  AdminPage,
});
