import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Every assertion here has to hold whether or not a Supabase project is
 * reachable.
 *
 * That is not a limitation of the test, it is the property being tested. CI has
 * no .env, so these run entirely unconfigured, which is exactly the state an
 * employer opening the deployed link finds when the free project has been
 * paused. If any of these need a live room, the site has a section that is
 * asserting something it cannot show.
 */

const SECTIONS = ['pipeline', 'presence', 'interpolation', 'policy', 'run', 'limits'] as const

test('@smoke the page loads and every section is present with or without a connection', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('120')

  for (const id of SECTIONS) {
    await expect(page.locator(`#${id}`)).toBeVisible()
  }

  expect(errors).toEqual([])
})

/**
 * The stage either draws or explains itself.
 *
 * Headless Firefox on a CI runner has no WebGL, which is the same position as a
 * visitor whose work laptop has hardware acceleration switched off. Before this
 * existed, that visitor got an uncaught THREE error and a black rectangle. One
 * of these two branches has to be true in every browser.
 */
test('the stage shows the room, or says why it cannot', async ({ page }) => {
  await page.goto('/')

  const canvas = page.locator('.stage-canvas canvas')
  const refused = page.getByRole('heading', { name: /will not give up a WebGL context/i })

  if (await canvas.count()) {
    await expect(canvas).toBeVisible()
    await expect(refused).toHaveCount(0)
  } else {
    await expect(refused).toBeVisible()
    // The point of the notice is that the rest of the page is still worth
    // reading, so the rest of the page had better still be there.
    await expect(page.locator('#interpolation')).toBeVisible()
  }
})

test('has no serious WCAG 2 A or AA violations', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The full accessibility scan runs in Chromium.')

  await page.goto('/')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})

test('the skip link is the first thing a keyboard reaches and it works', async ({
  page,
  browserName,
}) => {
  await page.goto('/')
  const skip = page.getByRole('link', { name: /skip to main content/i })

  // WebKit leaves links out of the tab order until the reader turns on "press
  // Tab to highlight each item on a webpage", which is off by default and is a
  // browser preference rather than anything this page decides. It lands on the
  // first button instead. Everywhere else the very first Tab has to arrive
  // here, and it is the first element in the document in all three.
  if (browserName !== 'webkit') {
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
  }

  await skip.focus()
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page.locator('#main')).toBeInViewport()
})

/**
 * This one exists because the site named two font families and fetched neither
 * for its first three months. document.fonts.check() is no good for catching
 * that: it returns true for a family with no @font-face rule at all, because
 * the text renders perfectly well in a fallback. Read the FontFaceSet instead.
 */
test('the three faces are actually fetched and loaded, not just named', async ({ page }) => {
  const fontResponses: { url: string; status: number }[] = []
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2')) {
      fontResponses.push({ url: response.url(), status: response.status() })
    }
  })

  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const faces = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
  )
  // Firefox reports the family with the quotes from the @font-face descriptor
  // still attached, so it answers "Anybody" where Chromium and WebKit answer
  // Anybody. Strip them before comparing or this passes in two browsers and
  // fails in the third for no reason to do with fonts.
  const loaded = (family: string) =>
    faces.some(
      (face) => face.family.replace(/^["']|["']$/g, '') === family && face.status === 'loaded',
    )

  const present = faces
    .filter((f) => f.status === 'loaded')
    .map((f) => f.family.replace(/^["']|["']$/g, ''))
  expect(loaded('Anybody'), `display face missing. Present: ${present.join(', ')}`).toBe(true)
  expect(loaded('Commit Mono'), `chrome face missing. Present: ${present.join(', ')}`).toBe(true)
  expect(loaded('Atkinson Next'), `body face missing. Present: ${present.join(', ')}`).toBe(true)

  expect(fontResponses.length).toBeGreaterThan(0)
  for (const response of fontResponses) {
    expect(response.status, `${response.url} did not return 200`).toBe(200)
    expect(new URL(response.url).origin).toBe(new URL(page.url()).origin)
  }
})

/** Every link posted to LinkedIn or an application form unfurled blank until
 *  these existed, which is an expensive defect for work whose purpose is to be
 *  shared with employers. */
test('the social preview metadata is present and absolute', async ({ page }) => {
  await page.goto('/')

  const content = async (selector: string) =>
    page.locator(selector).first().getAttribute('content')

  expect(await content('meta[property="og:title"]')).toContain('realtime-3d-room')
  expect(await content('meta[property="og:description"]')).toBeTruthy()
  expect(await content('meta[property="og:image"]')).toMatch(/^https:\/\/.+\/og\.png$/)
  expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\//)
})

/** The viewport meta carried maximum-scale=1.0 and user-scalable=no, which is a
 *  WCAG 1.4.4 failure that axe does not flag on every ruleset. */
test('pinch zoom is not blocked', async ({ page }) => {
  await page.goto('/')
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no/)
  expect(viewport).not.toMatch(/maximum-scale/)
})

for (const width of [375, 768, 1024, 1440]) {
  test(`nothing overflows the page horizontally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
}

test('every interactive target clears 44px at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/')

  const small = await page.evaluate(() => {
    const bad: string[] = []
    for (const el of document.querySelectorAll('button, a[href], input, [role="button"]')) {
      const rect = el.getBoundingClientRect()
      // Skip anything not rendered, and the skip link, which is off screen
      // until it takes focus.
      if (rect.width === 0 || rect.height === 0) continue
      if (el.classList.contains('skip-link')) continue
      // WCAG 2.5.8 exempts a target that is inline in a sentence, because
      // making it 44px tall would break the line it sits in. Everything that
      // is its own control still has to clear the floor.
      const inSentence = el.matches('p a, li a, dd a, caption a, figcaption a')
      if (inSentence) continue
      if (rect.height < 44) {
        bad.push(`${el.tagName}.${el.className} is ${Math.round(rect.height)}px tall`)
      }
    }
    return bad
  })

  expect(small).toEqual([])
})

test('the presence replay plays the recorded probe to scale', async ({ page }) => {
  await page.goto('/')

  const rows = page.locator('#presence .probe-row')
  await expect(rows).toHaveCount(12)

  // Five acknowledged, seven timed out: the measurement that decided the
  // architecture. If a re-recording changes that, this should fail loudly.
  await expect(page.locator('#presence .probe-row:not(.is-failed)')).toHaveCount(5)
  await expect(page.locator('#presence .probe-row.is-failed')).toHaveCount(7)

  await page.getByRole('button', { name: /replay the probe/i }).click()
  await expect(page.locator('#presence .probe-row.is-pending').first()).toBeVisible()
})

test('both interpolation panes are driven by the same replay and actually move', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('#interpolation').scrollIntoViewIfNeeded()

  const marker = page.locator('#interpolation .pane-marker').first()
  await expect(marker).toBeVisible()

  const at = () => marker.getAttribute('transform')
  const first = await at()
  await page.waitForTimeout(2500)
  expect(await at()).not.toBe(first)

  // The raw pane leads the smoothed one, because one draws the newest packet
  // and the other draws the position 120 ms before it.
  const transforms = await page.locator('#interpolation .pane-marker').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('transform')),
  )
  expect(transforms).toHaveLength(2)
  expect(transforms[0]).not.toBe(transforms[1])
})

test('the two policy attacks are offered and answered on the page', async ({ page }) => {
  await page.goto('/')

  const responses = page.locator('#policy .response')
  await expect(responses).toHaveCount(2)
  await expect(responses.first()).toContainText('Nothing sent yet')

  await expect(page.getByRole('button', { name: /try the insert/i })).toBeEnabled()
  await expect(page.getByRole('button', { name: /try the update/i })).toBeEnabled()
})

test('the footer links to both sibling projects', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('.site-footer')

  await expect(footer.getByRole('link', { name: 'three-dispose-guard' })).toHaveAttribute(
    'href',
    /three-dispose-guard/,
  )
  await expect(footer.getByRole('link', { name: 'scene-narrator' })).toHaveAttribute(
    'href',
    /scene-narrator/,
  )
})
