import { Band } from '../ui/Band'
import { CodeCard, InstallCommand } from '../chrome'
import { REPO_URL, SOURCE } from '../site'

const ENV = `VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx

# The publishable key is safe to ship in a browser bundle. It is the
# key the anon and authenticated Postgres roles use, and Row Level
# Security is what actually protects your data. Never put a
# service_role key in here.`

const STEPS = [
  {
    at: '1',
    title: 'Clone and install',
    body: 'No global tooling, no CLI to install first. Node 22 or later.',
  },
  {
    at: '2',
    title: 'Make a Supabase project',
    body: 'The free plan is enough for everything on this page. Turn on anonymous sign-ins under Authentication, Sign In / Providers.',
  },
  {
    at: '3',
    title: 'Copy two keys into .env',
    body: 'Project Settings, API Keys. Both values are public by design; the security is in the policy, not the key.',
  },
  {
    at: '4',
    title: 'Run the migration',
    body: (
      <>
        Paste <code>supabase/migrations/0001_guestbook.sql</code> into the SQL editor, or run{' '}
        <code>supabase db push</code>.
      </>
    ),
  },
]

export function Run() {
  return (
    <Band
      id="run"
      mark="~4 min"
      title="Clone it, add two keys, run it"
      lede={
        <>
          Everything measured on this page can be measured again on your own project. The recordings
          are committed so the site works without one, but the scripts that made them are in the
          repository and they take about two minutes each.
        </>
      }
    >
      <div className="run-grid">
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.at}>
              <span className="chain-at">{step.at}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="run-commands">
          <InstallCommand
            command="git clone https://github.com/OskarasM/realtime-3d-room"
            id="clone-command"
          />
          <InstallCommand command="npm install && npm run dev" id="dev-command" />
          <InstallCommand command="npm run spike" id="spike-command" />
          <InstallCommand command="npm run record" id="record-command" />
        </div>
      </div>

      <p className="run-note">
        <code>npm run spike</code> measures round trip time, the send rate ceiling, the presence
        allowance and a full room of eight clients, and prints a markdown block that goes straight
        into the README. <code>npm run record</code> writes the two recordings this page replays.
        Both send a lot of messages on purpose, so point them at a project you do not mind rate
        limiting.
      </p>

      <CodeCard filename=".env" status="both values are public">
        {ENV}
      </CodeCard>

      <p className="source-line">
        <a href={REPO_URL}>The repository</a> carries a 2,700 word walkthrough of why each of these
        decisions went the way it did, and{' '}
        <a href={SOURCE('spike/RESULTS.md')}>spike/RESULTS.md</a> holds the raw output of the run the
        numbers on this page came from.
      </p>
    </Band>
  )
}
