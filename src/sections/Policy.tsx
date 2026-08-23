import { useState } from 'react'
import { Band } from '../ui/Band'
import { CodeCard } from '../chrome'
import { supabase } from '../lib/supabase'
import { SOURCE } from '../site'

const POLICY_SQL = `-- Without this line every policy below is decoration.
alter table public.guestbook enable row level security;

create policy "guestbook is world readable"
  on public.guestbook for select
  to anon, authenticated
  using (true);

create policy "you may sign only as yourself"
  on public.guestbook for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- There is deliberately no update policy and no delete policy.
-- RLS denies anything a policy does not explicitly allow, so the
-- absence of those two is what makes the guestbook append only.`

type Attempt = { code: string; message: string; status: string; rows: string }

/**
 * The silent refusal, promoted out of a floating panel and onto the page.
 *
 * This is the section an employer should read twice. The publishable key is in
 * the JavaScript bundle and anybody can take it, so the guestbook is defended by
 * a Postgres policy rather than by client code, and the way to show that is to
 * attack it from the browser and print exactly what comes back.
 */
export function Policy() {
  const [insert, setInsert] = useState<Attempt | null>(null)
  const [update, setUpdate] = useState<Attempt | null>(null)
  const [busy, setBusy] = useState<'insert' | 'update' | null>(null)

  const signAsSomeoneElse = async () => {
    setBusy('insert')
    // Deliberately sign as somebody who is not us. The publishable key is happy
    // to send this. Postgres is not.
    const { error, status } = await supabase
      .from('guestbook')
      .insert({ user_id: crypto.randomUUID(), name: 'not me', colour: '#ff0000' })
    setInsert({
      code: error?.code ?? 'null',
      message: error?.message ?? 'It went through, which means the insert policy is missing.',
      status: String(status),
      rows: error ? '0' : '1',
    })
    setBusy(null)
  }

  const editSomeoneElse = async () => {
    setBusy('update')
    // The interesting one. There is no update policy at all, so this is not
    // rejected: it matches nothing, changes nothing, and succeeds.
    const { data, error, status } = await supabase
      .from('guestbook')
      .update({ name: 'edited' })
      .neq('user_id', '00000000-0000-4000-8000-000000000000')
      .select()
    setUpdate({
      code: error?.code ?? 'null',
      message: error?.message ?? 'null',
      status: String(status),
      rows: String(data?.length ?? 0),
    })
    setBusy(null)
  }

  return (
    <Band
      id="policy"
      mark="0 rows"
      title="The database said no, and said nothing"
      lede={
        <>
          The key that reaches this table is sitting in a public JavaScript bundle, where anybody can
          take it. Try both attacks below. One is refused with an error; the other succeeds, changes
          nothing, and tells you nothing, which is the more instructive of the two.
        </>
      }
    >
      <div className="attacks">
        <article className="attack">
          <h3>Sign the guestbook as somebody else</h3>
          <p>
            An insert with a <code>user_id</code> that is not yours. The policy checks the row
            against your session, so this one comes back as a refusal you cannot miss.
          </p>
          <button
            className="button is-primary"
            type="button"
            onClick={signAsSomeoneElse}
            disabled={busy !== null}
          >
            {busy === 'insert' ? 'Sending' : 'Try the insert'}
          </button>
          <Response result={insert} />
        </article>

        <article className="attack">
          <h3>Edit everybody else&apos;s row</h3>
          <p>
            An update with no <code>where</code> worth the name. There is no update policy at all, so
            it does not error. It matches nothing, and returns an empty list with a 200.
          </p>
          <button
            className="button is-primary"
            type="button"
            onClick={editSomeoneElse}
            disabled={busy !== null}
          >
            {busy === 'update' ? 'Sending' : 'Try the update'}
          </button>
          <Response result={update} loud />
        </article>
      </div>

      <div className="prose">
        <p>
          The second response is the one worth sitting with. Row Level Security denies anything a
          policy does not explicitly allow, so writing no update policy is what makes the guestbook
          append only. The client is not told it was denied, because from Postgres&apos;s point of
          view nothing was denied: the update ran against the rows you are allowed to see, which is
          none of them, and updating zero rows is a success.
        </p>
        <p>
          If you are building on this, the lesson is that a 200 with an empty array is not the same
          as a write that happened, and any code that treats them as the same will report success to
          a user whose change was silently discarded. Check the returned rows, not the absence of an
          error.
        </p>
      </div>

      <CodeCard filename="supabase/migrations/0001_guestbook.sql" status="the whole defence">
        {POLICY_SQL}
      </CodeCard>

      <p className="source-line">
        Full migration:{' '}
        <a href={SOURCE('supabase/migrations/0001_guestbook.sql')}>
          supabase/migrations/0001_guestbook.sql
        </a>
        . The primary key on <code>user_id</code> is doing the other half of the work: one signature
        per visitor is enforced by the schema, so a second tab and a hand-written fetch fail the same
        way.
      </p>
    </Band>
  )
}

/** Fixed height whether or not it has run, so pressing the button does not
 *  shove the rest of the section down the page. */
function Response({ result, loud }: { result: Attempt | null; loud?: boolean }) {
  return (
    <div className={`response${result ? ' is-filled' : ''}`} role="status">
      {result ? (
        <dl>
          <div>
            <dt>error.code</dt>
            <dd className={result.code === 'null' && loud ? 'is-loud' : undefined}>{result.code}</dd>
          </div>
          <div>
            <dt>status</dt>
            <dd>{result.status}</dd>
          </div>
          <div>
            <dt>rows affected</dt>
            <dd className={result.rows === '0' && loud ? 'is-loud' : undefined}>{result.rows}</dd>
          </div>
          <div className="response-message">
            <dt>error.message</dt>
            <dd>{result.message}</dd>
          </div>
        </dl>
      ) : (
        <p>Nothing sent yet.</p>
      )}
    </div>
  )
}
