// Admin module: nav shell + inbox + members + data hygiene
// Other admin sub-pages live in b-admin2.jsx

// ── Fixed-cost categories
const FIXED_COST_CATEGORIES = ['belastingen','verzekeringen','onderhoud','keuring','diversen'];
const FIXED_COST_LABELS = {
  belastingen:   { nl: 'Belastingen',   en: 'Road tax'     },
  verzekeringen: { nl: 'Verzekeringen', en: 'Insurance'     },
  onderhoud:     { nl: 'Onderhoud',     en: 'Maintenance'   },
  keuring:       { nl: 'Keuring',       en: 'Inspection'    },
  diversen:      { nl: 'Diversen',      en: 'Miscellaneous' },
};

function FixedCostEditor({ items, onChange, lang }) {
  const total = (items || []).reduce((s, c) => s + (c.amount || 0), 0);

  const update = (id, patch) => onChange(items.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id) => onChange(items.filter(c => c.id !== id));
  const add    = () => onChange([...items, {
    id: 'fc-' + Date.now(), category: 'diversen', description: '', amount: 0,
  }]);

  const sel = (v, onChange) => (
    <select value={v} onChange={e => onChange(e.target.value)} style={{
      fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1,
      padding: '5px 6px', border: `1px solid ${paperB.paperDark}`,
      background: paperB.paperDeep, color: paperB.ink,
      textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
    }}>
      {FIXED_COST_CATEGORIES.map(cat => (
        <option key={cat} value={cat}>{FIXED_COST_LABELS[cat][lang]}</option>
      ))}
    </select>
  );

  return (
    <div>
      {(items || []).map((c, i) => (
        <div key={c.id} style={{
          display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center',
        }}>
          {sel(c.category, v => update(c.id, { category: v }))}
          <input value={c.description}
            placeholder={lang === 'nl' ? 'Omschrijving' : 'Description'}
            onChange={e => update(c.id, { description: e.target.value })}
            style={{
              flex: 1, padding: '5px 8px', fontFamily: paperB.fontMono, fontSize: 10,
              border: `1px solid ${paperB.paperDark}`, background: paperB.paperDeep,
              color: paperB.ink, minWidth: 0,
            }}/>
          <input type="number" value={c.amount} step="1" min="0"
            onChange={e => update(c.id, { amount: parseFloat(e.target.value) || 0 })}
            style={{
              width: 68, padding: '5px 6px', fontFamily: paperB.fontMono, fontSize: 10,
              border: `1px solid ${paperB.paperDark}`, background: paperB.paperDeep,
              color: paperB.ink, textAlign: 'right',
            }}/>
          <div style={{ fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim, flexShrink: 0 }}>€</div>
          <button onClick={() => remove(c.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: paperB.accent, fontFamily: paperB.fontMono, fontSize: 12,
            padding: '2px 4px', flexShrink: 0, lineHeight: 1,
          }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button onClick={add} style={{
          background: 'transparent', border: `1.5px dashed ${paperB.ink}`,
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5,
          textTransform: 'uppercase', cursor: 'pointer', color: paperB.ink,
          padding: '5px 10px',
        }}>+ {lang === 'nl' ? 'Toevoegen' : 'Add'}</button>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700, color: paperB.ink,
        }}>= {fmtMoney(total)}</div>
      </div>
    </div>
  );
}

// ── Shared admin card primitives
function AdminCard({ children, stripe, pad = '16px 16px' }) {
  return (
    <div style={{
      background: paperB.paper, marginBottom: 12, padding: pad,
      borderLeft: stripe ? `3px solid ${stripe}` : 'none',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>{children}</div>
  );
}

function AdminSectionTitle({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '20px 20px 10px',
    }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 11, letterSpacing: 2,
        textTransform: 'uppercase', color: paperB.ink, fontWeight: 700,
      }}>— {children} —</div>
      {right && <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase',
      }}>{right}</div>}
    </div>
  );
}

function AdminNumber({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
        color: color || paperB.ink, lineHeight: 1.1, marginTop: 2,
        whiteSpace: 'nowrap',
      }}>{value}</div>
    </div>
  );
}

function AdminButton({ onClick, children, variant = 'solid', size = 'md' }) {
  const small = size === 'sm';
  const styles = variant === 'ghost' ? {
    background: 'transparent', color: paperB.ink,
    border: `1.5px dashed ${paperB.ink}`,
  } : variant === 'danger' ? {
    background: paperB.paper, color: paperB.accent,
    border: `1.5px solid ${paperB.accent}`,
  } : {
    background: paperB.ink, color: paperB.paper,
    border: `1.5px solid ${paperB.ink}`,
  };
  return (
    <button onClick={onClick} style={{
      padding: small ? '6px 10px' : '10px 14px',
      fontFamily: paperB.fontMono, fontSize: small ? 10 : 11,
      fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
      cursor: 'pointer', ...styles,
    }}>{children}</button>
  );
}

// ── Admin tab selector
function AdminTabs({ tab, setTab, lang }) {
  const t = strings[lang];
  const { caps } = useRole();
  const isAdmin = caps.isAdmin;
  const tabs = [
    { k: 'inbox',      l: t.beheerInbox      },
    { k: 'hygiene',    l: t.beheerHygiene    },
    { k: 'fleet',      l: t.beheerFleet      },
    isAdmin && { k: 'members',    l: t.beheerMembers    },
    isAdmin && { k: 'settle',     l: t.beheerSettle     },
    { k: 'payout',     l: t.beheerPayout     },
    isAdmin && { k: 'wagens',     l: t.beheerWagens     },
    isAdmin && { k: 'personen',   l: t.beheerPersonen   },
    isAdmin && { k: 'betalingen', l: t.beheerBetalingen },
  ].filter(Boolean);
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '12px 16px',
      overflowX: 'auto', background: paperB.paperDeep,
      borderBottom: `1px solid ${paperB.paperDark}`,
      WebkitOverflowScrolling: 'touch',
    }}>
      {tabs.map(x => {
        const sel = x.k === tab;
        return (
          <button key={x.k} onClick={() => setTab(x.k)} style={{
            padding: '7px 12px', flexShrink: 0,
            border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
            background: sel ? paperB.ink : paperB.paper,
            color: sel ? paperB.paper : paperB.ink, cursor: 'pointer',
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
            textTransform: 'uppercase', fontWeight: 700,
          }}>{x.l}</button>
        );
      })}
    </div>
  );
}

// ═══════════ Inbox: pending reservations ═══════════
function AdminInbox({ lang }) {
  const t = strings[lang];
  const { role, caps } = useRole();
  const [reservations, setReservations] = React.useState(() => [...RESERVATIONS]);
  const [mailOpen, setMailOpen] = React.useState(null);

  const pending = reservations.filter(r =>
    r.status === 'pending' &&
    (role !== 'owner' || caps.ownedCars.includes(r.car))
  );

  const approve = (id) => {
    setReservations(rs => rs.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
    setMailOpen({ id, action: 'approve' });
  };
  const reject = (id) => {
    setReservations(rs => rs.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    setMailOpen({ id, action: 'reject' });
  };

  const mailRes = mailOpen ? reservations.find(r => r.id === mailOpen.id) : null;

  return (
    <div>
      <AdminSectionTitle right={`${pending.length} ${lang === 'nl' ? 'aanvragen' : 'requests'}`}>
        {t.beheerInbox}
      </AdminSectionTitle>

      {pending.length === 0 && (
        <div style={{ padding: '0 20px' }}>
          <AdminCard>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 16, color: paperB.inkMute,
              fontStyle: 'italic', textAlign: 'center', padding: 20,
            }}>{t.inboxEmpty}</div>
          </AdminCard>
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        {pending.map(r => {
          const car = carByShort[r.car];
          const owner = car.eigenaar;
          const daysAgo = Math.max(0, Math.round(
            (new Date('2026-04-21') - new Date(r.requested)) / 86400000
          ));
          const conflict = pending.find(p =>
            p.id !== r.id && p.car === r.car &&
            !(p.to < r.from || p.from > r.to)
          );
          return (
            <AdminCard key={r.id} stripe={paperB.amber}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <CarStamp code={r.car} active/>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: paperB.fontSerif, fontSize: 17, fontWeight: 700,
                    color: paperB.ink, lineHeight: 1.1,
                  }}>{r.who}</div>
                  <div style={{
                    fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                    letterSpacing: 1, marginTop: 2,
                  }}>
                    {fmtDate(r.from, lang)}{r.from !== r.to && <> → {fmtDate(r.to, lang)}</>}
                  </div>
                </div>
                <div style={{
                  fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
                  letterSpacing: 1, textAlign: 'right',
                }}>
                  {daysAgo}{t.daysAgo}<br/>
                  <span style={{ color: paperB.inkDim }}>→ {owner}</span>
                </div>
              </div>

              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.ink,
                padding: '6px 0 10px', fontStyle: 'italic',
              }}>"{r.reason}"</div>

              {conflict && (
                <div style={{
                  padding: '8px 10px', marginBottom: 10,
                  background: `repeating-linear-gradient(45deg, ${paperB.paper} 0 6px, ${paperB.paperDeep} 6px 10px)`,
                  border: `1px dashed ${paperB.accent}`,
                  fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1,
                  color: paperB.accent, lineHeight: 1.5,
                }}>
                  ▲ {lang === 'nl' ? 'Conflict met' : 'Conflicts with'}: <b>{conflict.who}</b>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <AdminButton onClick={() => approve(r.id)} size="sm">
                  ✓ {t.approve}
                </AdminButton>
                <AdminButton onClick={() => reject(r.id)} variant="danger" size="sm">
                  ✗ {t.reject}
                </AdminButton>
                <div style={{ flex: 1 }}/>
                <AdminButton onClick={() => setMailOpen({ id: r.id, action: 'preview' })} variant="ghost" size="sm">
                  ✉ {t.mailPreview}
                </AdminButton>
              </div>
            </AdminCard>
          );
        })}
      </div>

      {/* Recent decisions */}
      <AdminSectionTitle>{lang === 'nl' ? 'Recent beslist' : 'Recently decided'}</AdminSectionTitle>
      <div style={{ padding: '0 16px' }}>
        {reservations
          .filter(r => r.status === 'confirmed' || r.status === 'rejected')
          .slice(-3)
          .map(r => (
            <div key={r.id} style={{
              background: paperB.paper, padding: '10px 14px', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: 0.8, borderLeft: `3px solid ${
                r.status === 'confirmed' ? paperB.green : paperB.accent
              }`,
            }}>
              <CarStamp code={r.car} active size="sm"/>
              <div style={{ flex: 1, fontFamily: paperB.fontSerif, fontSize: 13, color: paperB.ink }}>
                {r.who} · <span style={{ color: paperB.inkDim, fontFamily: paperB.fontMono, fontSize: 10 }}>
                  {fmtDate(r.from, lang)}
                </span>
              </div>
              <Stamp rotate={-4} color={r.status === 'confirmed' ? paperB.green : paperB.accent} size="sm">
                {t[r.status]}
              </Stamp>
            </div>
          ))}
      </div>

      {/* Mail mock overlay */}
      {mailOpen && mailRes && (
        <MailMockOverlay res={mailRes} action={mailOpen.action} lang={lang}
          onClose={() => setMailOpen(null)}/>
      )}
    </div>
  );
}

// ── Mail mock overlay — looks like a printed email
function MailMockOverlay({ res, action, lang, onClose }) {
  const t = strings[lang];
  const car = carByShort[res.car];
  const approved = action === 'approve';
  const isPreview = action === 'preview';
  const subject = isPreview
    ? (lang === 'nl' ? `Nieuwe aanvraag — ${car.name}` : `New request — ${car.name}`)
    : approved
    ? (lang === 'nl' ? `✓ Reservering bevestigd — ${car.name}` : `✓ Reservation confirmed — ${car.name}`)
    : (lang === 'nl' ? `✗ Reservering geweigerd — ${car.name}` : `✗ Reservation declined — ${car.name}`);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(26,26,26,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: paperB.paper, maxWidth: 380, width: '100%',
        padding: '24px 24px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '80vh', overflow: 'auto',
        transform: 'rotate(-0.3deg)',
      }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
          textTransform: 'uppercase', color: paperB.inkDim, marginBottom: 4,
        }}>From: autodelen@coop.be</div>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
          textTransform: 'uppercase', color: paperB.inkDim, marginBottom: 12,
        }}>To: {res.who.toLowerCase()}@...</div>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
          color: paperB.ink, lineHeight: 1.2, marginBottom: 14,
          letterSpacing: -0.3,
        }}>{subject}</div>
        <Perf/>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.ink,
          lineHeight: 1.55, padding: '10px 0',
        }}>
          {lang === 'nl' ? (
            <>
              Dag {res.who},<br/><br/>
              {isPreview
                ? <>Er ligt een nieuwe reservering voor <b>{car.name}</b> van {fmtDate(res.from, lang)}
                  {res.from !== res.to && <> tot {fmtDate(res.to, lang)}</>}
                  {' '}— reden: "{res.reason}".<br/><br/>
                  Bevestig of weiger met de knoppen hieronder of in de app.</>
                : approved
                ? <>Je reservering voor <b>{car.name}</b> van {fmtDate(res.from, lang)}
                  {res.from !== res.to && <> tot {fmtDate(res.to, lang)}</>} is bevestigd.<br/><br/>
                  Vergeet niet de rit in te voeren na afloop. Fijne rit!</>
                : <>Je reservering voor <b>{car.name}</b> op {fmtDate(res.from, lang)} is helaas niet bevestigd.<br/><br/>
                  Neem gerust contact op met de eigenaar voor meer uitleg.</>
              }
            </>
          ) : (
            <>
              Hi {res.who},<br/><br/>
              {isPreview
                ? <>New reservation request for <b>{car.name}</b> from {fmtDate(res.from, lang)}
                  {res.from !== res.to && <> to {fmtDate(res.to, lang)}</>} — reason: "{res.reason}".<br/><br/>
                  Confirm or decline via the buttons below or in the app.</>
                : approved
                ? <>Your reservation for <b>{car.name}</b> from {fmtDate(res.from, lang)}
                  {res.from !== res.to && <> to {fmtDate(res.to, lang)}</>} is confirmed.<br/><br/>
                  Don't forget to log the trip afterwards. Safe travels!</>
                : <>Your reservation for <b>{car.name}</b> on {fmtDate(res.from, lang)} could not be confirmed.<br/><br/>
                  Feel free to reach out to the owner directly.</>
              }
            </>
          )}
        </div>

        {isPreview && (
          <>
            <Perf/>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
              <AdminButton size="sm">✓ {t.approve}</AdminButton>
              <AdminButton variant="danger" size="sm">✗ {t.reject}</AdminButton>
            </div>
          </>
        )}

        <div style={{ textAlign: 'right', paddingTop: 14 }}>
          <AdminButton onClick={onClose} variant="ghost" size="sm">{t.annuleer}</AdminButton>
        </div>
      </div>
    </div>
  );
}

// ═══════════ Members + discounts ═══════════
function AdminMembers({ lang }) {
  const t = strings[lang];
  const [people, setPeople] = React.useState(() => PEOPLE.map(p => ({ ...p })));
  const [inviteInfo, setInviteInfo] = React.useState(null); // { name, token }

  const setK  = (name, k)  => setPeople(ps => ps.map(p => p.name === name ? { ...p, k }  : p));
  const setKl = (name, kl) => setPeople(ps => ps.map(p => p.name === name ? { ...p, kl } : p));
  const toggleAdmin = (name) => setPeople(ps => ps.map(p => p.name === name ? { ...p, isAdmin: !p.isAdmin } : p));

  const generateInvite = (person) => {
    const token = Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setInviteInfo({ name: person.name, token, url });
  };

  return (
    <div>
      <AdminSectionTitle right={`${people.length} ${lang === 'nl' ? 'leden' : 'members'}`}>
        {t.membersDiscounts}
      </AdminSectionTitle>

      {inviteInfo && (
        <div style={{
          margin: '0 16px 12px', padding: '12px 14px',
          background: paperB.green, color: paperB.paper,
        }}>
          <div style={{ fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            {lang === 'nl' ? `Uitnodiging voor ${inviteInfo.name} · gekopieerd` : `Invite for ${inviteInfo.name} · copied`}
          </div>
          <div style={{ fontFamily: paperB.fontMono, fontSize: 10, wordBreak: 'break-all', marginBottom: 8 }}>
            {inviteInfo.url}
          </div>
          <button onClick={() => setInviteInfo(null)} style={{
            background: 'transparent', border: `1px solid ${paperB.paper}`,
            color: paperB.paper, fontFamily: paperB.fontMono, fontSize: 9,
            letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer', padding: '4px 10px',
          }}>✕ {lang === 'nl' ? 'Sluiten' : 'Close'}</button>
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        {people.map(p => {
          const hasDisc = p.k > 0 || p.kl > 0;
          const ownedCars = CARS.filter(c => (c.ownerIds || [c.eigenaar]).includes(p.name)).map(c => c.short);
          const isOwner = ownedCars.length > 0;
          const stripeColor = p.isAdmin ? paperB.blue : isOwner ? paperB.amber : hasDisc ? paperB.accent : paperB.paperDark;

          return (
            <AdminCard key={p.name} stripe={stripeColor}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34,
                  background: p.isAdmin ? paperB.blue : isOwner ? paperB.amber : paperB.ink,
                  color: paperB.paper,
                  fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  letterSpacing: 0.5, flexShrink: 0,
                }}>{p.name.slice(0, 2).toUpperCase()}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <div style={{
                      fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 700,
                      color: paperB.ink, lineHeight: 1.1,
                    }}>{p.name}</div>
                    {p.isAdmin && (
                      <div style={{
                        fontFamily: paperB.fontMono, fontSize: 7, fontWeight: 700,
                        color: paperB.blue, border: `1px solid ${paperB.blue}`,
                        padding: '1px 5px', letterSpacing: 1, textTransform: 'uppercase',
                      }}>Admin</div>
                    )}
                    {isOwner && (
                      <div style={{
                        fontFamily: paperB.fontMono, fontSize: 7, fontWeight: 700,
                        color: paperB.amber, border: `1px solid ${paperB.amber}`,
                        padding: '1px 5px', letterSpacing: 1, textTransform: 'uppercase',
                      }}>{ownedCars.join(' · ')}</div>
                    )}
                  </div>
                  <div style={{
                    fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
                    letterSpacing: 1, marginTop: 2,
                  }}>@{p.username}</div>
                </div>

                <button onClick={() => generateInvite(p)} style={{
                  background: 'transparent', border: `1.5px dashed ${paperB.ink}`,
                  fontFamily: paperB.fontMono, fontSize: 8, letterSpacing: 1,
                  textTransform: 'uppercase', cursor: 'pointer', color: paperB.ink,
                  padding: '5px 8px', flexShrink: 0,
                }}>✉ {lang === 'nl' ? 'Uitnodigen' : 'Invite'}</button>
              </div>

              {/* Admin toggle */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderTop: `1px dashed ${paperB.paperDark}`, marginBottom: 6,
              }}>
                <div style={{
                  fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                  letterSpacing: 1.5, textTransform: 'uppercase',
                }}>{lang === 'nl' ? 'Admin-rechten' : 'Admin rights'}</div>
                <button onClick={() => toggleAdmin(p.name)} style={{
                  padding: '4px 10px',
                  background: p.isAdmin ? paperB.blue : 'transparent',
                  color: p.isAdmin ? paperB.paper : paperB.inkDim,
                  border: `1.5px solid ${p.isAdmin ? paperB.blue : paperB.paperDark}`,
                  fontFamily: paperB.fontMono, fontSize: 8, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
                }}>{p.isAdmin ? '✓ Admin' : (lang === 'nl' ? 'Geen admin' : 'Not admin')}</button>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <DiscountSlider label={t.baseDiscount} value={p.k}
                  onChange={v => setK(p.name, v)}/>
                <DiscountSlider label={t.longDiscountPct} value={p.kl}
                  onChange={v => setKl(p.name, v)}/>
              </div>
            </AdminCard>
          );
        })}
      </div>
    </div>
  );
}

function DiscountSlider({ label, value, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min="0" max="0.5" step="0.05" value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: paperB.accent }}/>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 12, fontWeight: 700,
          color: value > 0 ? paperB.accent : paperB.inkMute, minWidth: 38,
          textAlign: 'right',
        }}>−{Math.round(value * 100)}%</div>
      </div>
    </div>
  );
}

// ═══════════ Data hygiene: km gaps + suspect fuel ═══════════
function AdminHygiene({ lang }) {
  const t = strings[lang];
  const { role, caps } = useRole();
  const allGaps = findKmGaps();
  const allSuspect = findSuspectFuel();
  const gaps    = role === 'owner' ? allGaps.filter(g => caps.ownedCars.includes(g.car))        : allGaps;
  const suspect = role === 'owner' ? allSuspect.filter(s => caps.ownedCars.includes(s.fuel.car)) : allSuspect;

  return (
    <div>
      <AdminSectionTitle right={`${gaps.length} ${t.missing}`}>
        ✕ {t.kmGaps}
      </AdminSectionTitle>
      <div style={{ padding: '0 16px' }}>
        {gaps.length === 0 ? (
          <AdminCard>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.inkMute,
              fontStyle: 'italic', textAlign: 'center', padding: 12,
            }}>{lang === 'nl' ? 'Geen gaten gevonden ✓' : 'No gaps detected ✓'}</div>
          </AdminCard>
        ) : gaps.map(g => <KmGapCard key={g.id} gap={g} lang={lang}/>)}
      </div>

      <AdminSectionTitle right={`${suspect.length} ${t.suspect}`}>
        ⚠ {t.fuelSuspect}
      </AdminSectionTitle>
      <div style={{ padding: '0 16px' }}>
        {suspect.length === 0 ? (
          <AdminCard>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.inkMute,
              fontStyle: 'italic', textAlign: 'center', padding: 12,
            }}>{lang === 'nl' ? 'Alles ziet er ok uit ✓' : 'All looks fine ✓'}</div>
          </AdminCard>
        ) : suspect.map(s => <SuspectFuelCard key={s.id} item={s} lang={lang}/>)}
      </div>
    </div>
  );
}

function KmGapCard({ gap, lang }) {
  const t = strings[lang];
  const [assignedTo, setAssignedTo] = React.useState(null);

  return (
    <AdminCard stripe={paperB.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <CarStamp code={gap.car} active size="sm"/>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 700,
            color: paperB.ink, lineHeight: 1.1,
          }}>{gap.missingKm} km {t.missing}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1, marginTop: 2,
          }}>
            {fmtDate(gap.after.date, lang)} → {fmtDate(gap.before.date, lang)}
          </div>
        </div>
      </div>

      <div style={{
        background: paperB.paperDeep, padding: '8px 12px',
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        lineHeight: 1.6, marginBottom: 10,
      }}>
        <div>↑ {gap.after.eind.toLocaleString('nl-BE')} km <span style={{ color: paperB.inkMute }}>({gap.after.who})</span></div>
        <div style={{ color: paperB.accent, fontWeight: 700 }}>?  …{gap.missingKm} km gap…</div>
        <div>↓ {gap.before.start.toLocaleString('nl-BE')} km <span style={{ color: paperB.inkMute }}>({gap.before.who})</span></div>
      </div>

      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
      }}>{t.assignToMember}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {[null, ...PEOPLE.slice(0, 9)].map((p, i) => {
          const label = p === null ? (lang === 'nl' ? 'Coöp' : 'Co-op') : p.name.slice(0, 4);
          const sel = p === null ? assignedTo === null && assignedTo !== undefined
                                 : assignedTo === p.name;
          return (
            <button key={i} onClick={() => setAssignedTo(p === null ? 'COOP' : p.name)} style={{
              padding: '6px 4px',
              border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
              background: (p === null ? assignedTo === 'COOP' : sel) ? paperB.ink : paperB.paper,
              color: (p === null ? assignedTo === 'COOP' : sel) ? paperB.paper : paperB.ink,
              cursor: 'pointer', fontFamily: paperB.fontMono, fontSize: 9,
              fontWeight: 700, letterSpacing: 0.5,
            }}>{label}</button>
          );
        })}
      </div>

      {assignedTo && (
        <div style={{ marginTop: 10 }}>
          <AdminButton size="sm">
            ✓ {lang === 'nl' ? 'Ghost-rit toevoegen' : 'Add ghost trip'}
          </AdminButton>
        </div>
      )}
    </AdminCard>
  );
}

function SuspectFuelCard({ item, lang }) {
  const t = strings[lang];
  const [split, setSplit] = React.useState(false);
  const f = item.fuel;

  return (
    <AdminCard stripe={paperB.amber}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <CarStamp code={f.car} active size="sm"/>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 700,
            color: paperB.ink, lineHeight: 1.1,
          }}>⛽ {f.location}</div>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1, marginTop: 2,
          }}>
            {f.who} · {fmtDate(f.date, lang)} · {f.liter.toFixed(1)}L · {fmtMoney(f.bedrag)}
          </div>
        </div>
      </div>

      {item.reasons.map((r, i) => (
        <div key={i} style={{
          fontFamily: paperB.fontMono, fontSize: 9, color: paperB.amber,
          letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
          marginLeft: 2,
        }}>⚠ {r}</div>
      ))}

      <div style={{ marginTop: 10 }}>
        <AdminButton onClick={() => setSplit(s => !s)} variant={split ? 'solid' : 'ghost'} size="sm">
          ✂ {t.splitFuel}
        </AdminButton>
      </div>

      {split && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: paperB.paperDeep,
          animation: 'popIn 0.2s ease-out',
        }}>
          <SplitFuelForm bedrag={f.bedrag} liter={f.liter} lang={lang}/>
        </div>
      )}
    </AdminCard>
  );
}

function SplitFuelForm({ bedrag, liter, lang }) {
  const [parts, setParts] = React.useState([
    { b: bedrag / 2, l: liter / 2, date: '' },
    { b: bedrag / 2, l: liter / 2, date: '' },
  ]);
  const totalB = parts.reduce((s,p) => s + p.b, 0);
  const diff = Math.abs(totalB - bedrag);

  const setPart = (i, k, v) => setParts(ps => ps.map((p,j) => j === i ? { ...p, [k]: v } : p));

  return (
    <div>
      {parts.map((p, i) => (
        <div key={i} style={{
          display: 'flex', gap: 8, marginBottom: 8, alignItems: 'baseline',
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 1, width: 16,
          }}>{i+1}.</div>
          <input type="number" value={p.b.toFixed(2)} step="0.01"
            onChange={e => setPart(i, 'b', parseFloat(e.target.value) || 0)}
            style={{
              flex: 1, padding: '4px 8px', width: '100%',
              fontFamily: paperB.fontMono, fontSize: 12,
              border: `1px solid ${paperB.inkMute}`, background: paperB.paper,
              outline: 'none',
            }}/>
          <span style={{ fontFamily: paperB.fontMono, fontSize: 10 }}>€</span>
          <input type="number" value={p.l.toFixed(2)} step="0.01"
            onChange={e => setPart(i, 'l', parseFloat(e.target.value) || 0)}
            style={{
              flex: 1, padding: '4px 8px', width: '100%',
              fontFamily: paperB.fontMono, fontSize: 12,
              border: `1px solid ${paperB.inkMute}`, background: paperB.paper,
              outline: 'none',
            }}/>
          <span style={{ fontFamily: paperB.fontMono, fontSize: 10 }}>L</span>
        </div>
      ))}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: paperB.fontMono, fontSize: 10, marginTop: 6,
        color: diff < 0.01 ? paperB.green : paperB.accent,
      }}>
        <span>Σ</span>
        <span>{fmtMoney(totalB)} / {fmtMoney(bedrag)}</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  AdminCard, AdminSectionTitle, AdminNumber, AdminButton, AdminTabs,
  AdminInbox, MailMockOverlay,
  AdminMembers, DiscountSlider,
  AdminHygiene, KmGapCard, SuspectFuelCard, SplitFuelForm,
  FIXED_COST_CATEGORIES, FIXED_COST_LABELS, FixedCostEditor,
});
