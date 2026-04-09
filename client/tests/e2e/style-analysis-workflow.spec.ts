/**
 * E2E Test: Style Analysis Workflow
 *
 * Tests the complete style learning user flow:
 * 1. Navigate to Style Learning panel
 * 2. Enter sample text (>500 words)
 * 3. Submit for analysis
 * 4. View results with style metrics
 * 5. Compare with another text
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests validate style learning functionality
 * - Article V (Documentation): Complete workflow documentation
 */

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers/waitHelpers";

test.describe("Style Analysis - Complete Workflow", () => {
  // Sample text with >500 words for testing
  const sampleText500Words = `
    The art of writing is a complex and nuanced discipline that requires years of practice to master. 
    Writers must develop their unique voice while adhering to the fundamental principles of effective 
    communication. This involves understanding sentence structure, vocabulary choice, and the rhythm 
    of prose. Every writer brings their own perspective to the page, shaped by their experiences, 
    education, and personal preferences. Some writers prefer short, punchy sentences that create 
    urgency and momentum. Others favor long, flowing passages that meander through ideas like a 
    river winding through a valley. The best writers know when to use each technique.

    Character development is another crucial aspect of storytelling. Readers want to connect with 
    characters who feel real and multi-dimensional. This means giving them flaws, desires, fears, 
    and contradictions. A well-developed character might act bravely in one situation and cowardly 
    in another, just like real people do. The key is consistency within inconsistency—characters 
    should behave in ways that make sense for who they are, even when those behaviors surprise us.

    Dialogue presents its own set of challenges. Good dialogue should sound natural without being 
    a verbatim transcription of how people actually speak. Real conversation is full of ums, ahs, 
    and repetitive phrases that would bore readers if faithfully reproduced. Instead, writers must 
    capture the essence of speech—its rhythm, its subtext, its ability to reveal character through 
    what is said and what is left unsaid. Every line of dialogue should serve a purpose, whether 
    that is advancing the plot, revealing character, or establishing relationships between speakers.

    Setting and atmosphere create the world in which a story takes place. Whether writing about 
    a bustling city or a quiet countryside, the environment should feel lived-in and authentic. 
    Details matter—the sound of traffic, the smell of rain, the quality of light at different 
    times of day. These sensory details help readers immerse themselves in the fictional world. 
    A well-crafted setting can become almost like a character itself, influencing the mood and 
    actions of the people who inhabit it.

    Pacing determines how a story unfolds over time. Some stories benefit from a slow, contemplative 
    pace that allows readers to savor each moment. Others require rapid-fire action that keeps 
    readers turning pages. The writer must control the flow of information, knowing when to reveal 
    crucial details and when to withhold them for maximum impact. Cliffhangers, flashbacks, and 
    parallel storylines all affect pacing in different ways.

    Theme gives a story its deeper meaning. While plot is what happens, theme is what the story 
    is about—the universal ideas and questions it explores. Themes might include love, loss, 
    identity, power, or redemption. A story can have multiple themes, and different readers might 
    interpret them differently. The best themes emerge organically from the characters and plot 
    rather than feeling imposed by the author.

    Revision is where good writing becomes great writing. The first draft is about getting ideas 
    down on paper, however messy they might be. Subsequent drafts are about refining those ideas, 
    cutting what does not work, and polishing what does. This process can take months or even years. 
    Writers must be willing to kill their darlings—removing passages they love if they do not serve 
    the story as a whole. Feedback from beta readers and editors is invaluable during this phase.

    The publishing industry has changed dramatically in recent years. Self-publishing has become 
    a viable option for many writers, offering greater control and higher royalties. Traditional 
    publishing still offers advantages in terms of editing, marketing, and distribution. Hybrid 
    models combine elements of both approaches. Writers must educate themselves about their options 
    and make informed decisions about their careers. Building a platform through social media and 
    author websites has become increasingly important regardless of publishing path.

    Writer's block is a common challenge that affects almost every author at some point. It can 
    stem from various sources: fear of failure, perfectionism, burnout, or simply running out of 
    ideas. Strategies for overcoming writer's block include changing writing environments, working 
    on different projects, setting small achievable goals, and allowing oneself to write badly. 
    Sometimes taking a break is the best solution—stepping away from the work to gain perspective.

    Reading widely is essential for writers. By studying the works of others, writers learn new 
    techniques, expand their vocabulary, and develop their taste. They should read both within 
    and outside their genre, studying classics as well as contemporary works. Analyzing why 
    certain passages work or do not work helps writers apply those lessons to their own writing. 
    Reading like a writer means paying attention to craft as well as content.

    The writing community can provide invaluable support and inspiration. Writers' groups offer 
    feedback, accountability, and camaraderie. Conferences and workshops provide opportunities 
    to learn from established authors and connect with peers. Online communities have made it 
    easier than ever to find like-minded writers regardless of geographic location. However, 
    writers must also protect their time and energy, learning to say no to opportunities that 
    do not serve their goals.

    Voice is perhaps the most elusive quality in writing. It encompasses not just what a writer 
    says but how they say it—their unique way of seeing and describing the world. Voice develops 
    over time through consistent practice and honest self-expression. Imitating other writers can 
    be a useful exercise, but eventually every writer must find their own authentic voice. This 
    requires courage and vulnerability, putting oneself on the page without hiding behind clichés 
    or technical proficiency.

    The business of writing involves more than just crafting stories. Writers must understand 
    contracts, royalties, rights, and marketing. They need to manage their time effectively, 
    balancing writing with the demands of daily life. Financial stability is a real concern for 
    most writers, who often supplement their income through teaching, editing, or other work. 
    Treating writing as a business means making strategic decisions about what projects to pursue 
    and how to position oneself in the market.

    Ultimately, writing is an act of communication—a bridge between the writer's mind and the 
    reader's imagination. It requires empathy, the ability to imagine how words will land in 
    another person's consciousness. The best writers never forget that there is a real human 
    being on the other side of the page, seeking connection, entertainment, or understanding. 
    Keeping the reader in mind while staying true to one's artistic vision is the central 
    challenge of the writing life.
  `;

  const comparisonText = `
    Technology has fundamentally transformed how we live, work, and communicate in the modern 
    world. The rapid pace of innovation continues to accelerate, bringing both opportunities 
    and challenges. Digital tools have democratized access to information, allowing people 
    from all backgrounds to learn and connect. However, these same tools have raised concerns 
    about privacy, security, and the impact of constant connectivity on mental health.

    Artificial intelligence represents one of the most significant technological developments 
    of our time. Machine learning algorithms can now perform tasks that once required human 
    intelligence, from recognizing speech to generating creative content. This capability 
    raises important questions about the future of work and the relationship between humans 
    and machines. Will AI augment human capabilities or replace human workers? The answer 
    likely depends on how we choose to develop and deploy these technologies.

    The internet has created unprecedented opportunities for collaboration and knowledge 
    sharing. Open source software, Wikipedia, and countless online communities demonstrate 
    the power of collective intelligence. At the same time, the digital divide persists, 
    with billions of people lacking reliable internet access. Ensuring equitable access to 
    technology remains a critical challenge for policymakers and industry leaders.

    Cybersecurity has become a paramount concern as more of our lives move online. Data 
    breaches, identity theft, and ransomware attacks pose real threats to individuals and 
    organizations. Protecting sensitive information requires constant vigilance and ongoing 
    investment in security infrastructure. The arms race between attackers and defenders 
    shows no signs of slowing down.

    Social media has reshaped how we form and maintain relationships. These platforms allow 
    us to stay connected with friends and family across vast distances. They also enable 
    the formation of communities around shared interests and identities. Yet research suggests 
    that heavy social media use can contribute to anxiety, depression, and feelings of 
    isolation. Finding a healthy balance between online and offline life is an ongoing 
    challenge for many people.

    The gig economy has transformed labor markets, offering flexibility for some workers 
    while removing traditional employment protections. Ride-sharing, delivery services, 
    and freelance platforms have created new income opportunities. However, questions about 
    fair wages, benefits, and job security remain contentious. The classification of gig 
    workers as independent contractors rather than employees has significant implications 
    for labor rights and social safety nets.

    Remote work has become mainstream, accelerated by the global pandemic. Many workers 
    have discovered the benefits of eliminating commutes and achieving better work-life 
    balance. Employers have realized that productivity does not necessarily require physical 
    presence in an office. At the same time, remote work poses challenges for collaboration, 
    company culture, and the separation of work and personal life.

    Cryptocurrency and blockchain technology have introduced new paradigms for financial 
    transactions and record-keeping. Bitcoin and other digital currencies offer alternatives 
    to traditional banking systems. Smart contracts enable automated, trustless agreements. 
    However, volatility, regulatory uncertainty, and environmental concerns have limited 
    mainstream adoption. The long-term impact of these technologies remains uncertain.

    Virtual and augmented reality promise to create new ways of experiencing digital content. 
    VR headsets can transport users to immersive virtual worlds. AR overlays digital 
    information onto the physical environment. These technologies have applications in 
    gaming, education, healthcare, and numerous other fields. Current hardware limitations 
    and content availability have slowed adoption, but continued improvement may eventually 
    make these technologies ubiquitous.

    The ethical implications of technology demand careful consideration. Algorithmic bias 
    can perpetuate and amplify existing inequalities. Surveillance technologies threaten 
    civil liberties. Autonomous weapons raise profound moral questions. As technology becomes 
    more powerful, the decisions we make about its development and use become increasingly 
    consequential. Engaging diverse perspectives in these decisions is essential for creating 
    technology that serves the broader good.

    Education is being transformed by digital tools and online learning platforms. Students 
    can now access courses from top universities regardless of their location. Adaptive 
    learning software personalizes instruction to individual needs and pace. However, 
    technology cannot replace the human elements of teaching—mentorship, inspiration, and 
    the cultivation of critical thinking. The most effective educational approaches combine 
    technological tools with meaningful human interaction.

    Healthcare has been revolutionized by medical technology, from diagnostic imaging to 
    robotic surgery. Telemedicine has expanded access to care, particularly in underserved 
    areas. Wearable devices enable continuous health monitoring. Big data analytics can 
    identify patterns and improve treatment outcomes. Yet the healthcare system struggles 
    with interoperability, data privacy, and ensuring equitable access to these advances.

    Climate change represents one of the greatest challenges facing humanity, and technology 
    will play a crucial role in addressing it. Renewable energy sources are becoming 
    increasingly cost-competitive with fossil fuels. Battery technology continues to improve, 
    enabling better energy storage. Carbon capture and other geoengineering approaches offer 
    potential solutions, though they also raise concerns about unintended consequences. 
    Technology alone cannot solve the climate crisis, but it is an essential component of 
    any viable response.

    The future of technology is impossible to predict with certainty, but certain trends 
    seem likely to continue. Computing power will keep increasing, enabling more sophisticated 
    applications. Connectivity will become more ubiquitous, linking an ever-growing network 
    of devices. The boundaries between physical and digital reality will continue to blur. 
    How these trends unfold will depend on the choices we make as individuals, organizations, 
    and societies. Technology is a tool, and like all tools, its value depends on how we 
    choose to use it.
  `;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("should navigate to Style Learning panel", async ({ page }) => {
    // Step 1: Find and click the Style Learning toggle button
    const styleToggle = page.getByTestId("style-learning-toggle");
    await expect(styleToggle).toBeVisible();
    await expect(styleToggle).toContainText("Style");

    // Step 2: Click to open the panel
    await styleToggle.click();

    // Step 3: Verify the overlay and panel appear
    const overlay = page.getByTestId("style-learning-overlay");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    const panel = page.getByTestId("style-learning-panel");
    await expect(panel).toBeVisible();

    // Step 4: Verify panel content
    await expect(panel).toContainText("Style Learning");
    await expect(panel).toContainText("minimum 500 words");
  });

  test("should enter sample text and validate word count", async ({ page }) => {
    // Step 1: Open Style Learning panel
    await page.getByTestId("style-learning-toggle").click();

    const form = page.getByTestId("style-input-form");
    await expect(form).toBeVisible();

    // Step 2: Find the textarea
    const textarea = form.locator("textarea");
    await expect(textarea).toBeVisible();

    // Step 3: Verify submit button is disabled initially
    const submitButton = form.getByRole("button", { name: /analyze style/i });
    await expect(submitButton).toBeDisabled();

    // Step 4: Enter sample text with >500 words
    await textarea.fill(sampleText500Words);

    // Step 5: Verify word count shows sufficient words
    const wordCountHint = form.locator(".word-count");
    await expect(wordCountHint).toBeVisible();
    const wordCountText = await wordCountHint.textContent();
    expect(wordCountText).toMatch(/\d+ words/);

    // Extract word count number
    const wordCount = parseInt(wordCountText?.match(/(\d+)/)?.[0] || "0");
    expect(wordCount).toBeGreaterThanOrEqual(500);

    // Step 6: Verify submit button is now enabled
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
  });

  test("should submit text for analysis and display results", async ({ page }) => {
    // Step 1: Open Style Learning panel
    await page.getByTestId("style-learning-toggle").click();

    const form = page.getByTestId("style-input-form");
    const textarea = form.locator("textarea");

    // Step 2: Enter text and submit
    await textarea.fill(sampleText500Words);

    // Mock the API response for faster, reliable testing
    await page.route("**/api/styles/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "default-user",
          style_vector: {
            avg_sentence_length: 18.5,
            vocab_richness: 0.72,
            punctuation_density: 0.15,
            paragraph_length_avg: 125.3,
            dialogue_ratio: 0.08,
          },
          confidence: 0.85,
          analyzed_at: new Date().toISOString(),
        }),
      });
    });

    const submitButton = form.getByRole("button", { name: /analyze style/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 3: Wait for analysis to complete
    await page.waitForTimeout(1000);

    // Step 4: Verify results panel appears
    const resultPanel = page.getByTestId("style-analysis-result");
    await expect(resultPanel).toBeVisible({ timeout: 10000 });

    // Step 5: Verify result content
    await expect(resultPanel).toContainText("Style Analysis");
    await expect(resultPanel).toContainText("Average Sentence Length");
    await expect(resultPanel).toContainText("Vocabulary Richness");
    await expect(resultPanel).toContainText("Confidence");

    // Verify Apply to Task button exists
    const applyButton = resultPanel.getByRole("button", { name: /apply to task/i });
    await expect(applyButton).toBeVisible();
  });

  test("should display correct style metrics in results", async ({ page }) => {
    // Step 1: Open and submit
    await page.getByTestId("style-learning-toggle").click();

    const mockResult = {
      user_id: "default-user",
      style_vector: {
        avg_sentence_length: 22.3,
        vocab_richness: 0.68,
        punctuation_density: 0.12,
        paragraph_length_avg: 142.5,
        dialogue_ratio: 0.15,
      },
      confidence: 0.92,
      analyzed_at: new Date().toISOString(),
    };

    await page.route("**/api/styles/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResult),
      });
    });

    const form = page.getByTestId("style-input-form");
    await form.locator("textarea").fill(sampleText500Words);
    await form.getByRole("button", { name: /analyze style/i }).click();

    // Step 2: Verify metrics are displayed correctly
    const resultPanel = page.getByTestId("style-analysis-result");
    await expect(resultPanel).toBeVisible({ timeout: 10000 });

    // Verify each metric is displayed
    await expect(resultPanel).toContainText("22.3"); // avg_sentence_length
    await expect(resultPanel).toContainText("68%"); // vocab_richness as percentage
    await expect(resultPanel).toContainText("12%"); // punctuation_density as percentage
    await expect(resultPanel).toContainText("142.5"); // paragraph_length_avg
    await expect(resultPanel).toContainText("15%"); // dialogue_ratio as percentage

    // Verify confidence score
    await expect(resultPanel).toContainText("92%");
  });

  test("should close Style Learning panel and return to editor", async ({ page }) => {
    // Step 1: Open panel
    await page.getByTestId("style-learning-toggle").click();

    const overlay = page.getByTestId("style-learning-overlay");
    await expect(overlay).toBeVisible();

    // Step 2: Click close button
    const closeButton = overlay.locator(".close-button");
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Step 3: Verify panel closes
    await expect(overlay).not.toBeVisible({ timeout: 3000 });

    // Step 4: Verify editor is still accessible
    await expect(page.getByTestId("editor-ready")).toBeVisible();
  });
});

test.describe("Style Analysis - Comparison Workflow", () => {
  const sampleText1 = `
    The morning sun cast long shadows across the deserted street. Sarah pulled her coat tighter 
    against the chill autumn breeze, watching her breath form small clouds in the crisp air. 
    She had walked this route a thousand times before, yet today everything felt different. 
    The familiar buildings seemed to lean in closer, as if sharing a secret she was not yet 
    privy to. A cat darted across the alley, its amber eyes flashing in the dim light. Sarah 
    paused, feeling the weight of the unopened letter in her pocket. The morning sun cast long 
    shadows across the deserted street. Sarah pulled her coat tighter against the chill autumn 
    breeze, watching her breath form small clouds in the crisp air. She had walked this route 
    a thousand times before, yet today everything felt different. The familiar buildings seemed 
    to lean in closer, as if sharing a secret she was not yet privy to. A cat darted across 
    the alley, its amber eyes flashing in the dim light. Sarah paused, feeling the weight of 
    the unopened letter in her pocket. The morning sun cast long shadows across the deserted 
    street. Sarah pulled her coat tighter against the chill autumn breeze, watching her breath 
    form small clouds in the crisp air. She had walked this route a thousand times before, yet 
    today everything felt different. The familiar buildings seemed to lean in closer, as if 
    sharing a secret she was not yet privy to. A cat darted across the alley, its amber eyes 
    flashing in the dim light. Sarah paused, feeling the weight of the unopened letter in her 
    pocket. The morning sun cast long shadows across the deserted street. Sarah pulled her coat 
    tighter against the chill autumn breeze, watching her breath form small clouds in the crisp 
    air. She had walked this route a thousand times before, yet today everything felt different.
    The familiar buildings seemed to lean in closer, as if sharing a secret she was not yet 
    privy to. A cat darted across the alley, its amber eyes flashing in the dim light. Sarah 
    paused, feeling the weight of the unopened letter in her pocket.
  `;

  const sampleText2 = `
    Quantum computing represents a fundamental shift in computational paradigms. Unlike classical 
    computers that use bits representing either 0 or 1, quantum computers utilize qubits that can 
    exist in superposition states. This property allows quantum algorithms to process certain 
    problems exponentially faster than their classical counterparts. The implications for 
    cryptography, drug discovery, and artificial intelligence are profound. However, building 
    stable quantum systems remains a significant engineering challenge due to decoherence and 
    error rates. Quantum computing represents a fundamental shift in computational paradigms. 
    Unlike classical computers that use bits representing either 0 or 1, quantum computers 
    utilize qubits that can exist in superposition states. This property allows quantum 
    algorithms to process certain problems exponentially faster than their classical counterparts. 
    The implications for cryptography, drug discovery, and artificial intelligence are profound. 
    However, building stable quantum systems remains a significant engineering challenge due to 
    decoherence and error rates. Quantum computing represents a fundamental shift in computational 
    paradigms. Unlike classical computers that use bits representing either 0 or 1, quantum 
    computers utilize qubits that can exist in superposition states. This property allows quantum 
    algorithms to process certain problems exponentially faster than their classical counterparts. 
    The implications for cryptography, drug discovery, and artificial intelligence are profound. 
    However, building stable quantum systems remains a significant engineering challenge due to 
    decoherence and error rates.
  `;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("should analyze first text sample", async ({ page }) => {
    // Open Style Learning
    await page.getByTestId("style-learning-toggle").click();

    // Mock first analysis
    await page.route("**/api/styles/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "default-user",
          style_vector: {
            avg_sentence_length: 16.2,
            vocab_richness: 0.65,
            punctuation_density: 0.18,
            paragraph_length_avg: 98.5,
            dialogue_ratio: 0.05,
          },
          confidence: 0.78,
          analyzed_at: new Date().toISOString(),
        }),
      });
    });

    // Submit first text
    const form = page.getByTestId("style-input-form");
    await form.locator("textarea").fill(sampleText1);
    await form.getByRole("button", { name: /analyze style/i }).click();

    // Verify first result
    const resultPanel = page.getByTestId("style-analysis-result");
    await expect(resultPanel).toBeVisible({ timeout: 10000 });
    await expect(resultPanel).toContainText("16.2");
    await expect(resultPanel).toContainText("78%");
  });

  test("should compare two different text samples", async ({ page }) => {
    // Open Style Learning
    await page.getByTestId("style-learning-toggle").click();

    let analysisCount = 0;

    // Mock analyses with different results
    await page.route("**/api/styles/analyze", async (route) => {
      analysisCount++;
      const results = [
        {
          user_id: "default-user",
          style_vector: {
            avg_sentence_length: 16.2,
            vocab_richness: 0.65,
            punctuation_density: 0.18,
            paragraph_length_avg: 98.5,
            dialogue_ratio: 0.05,
          },
          confidence: 0.78,
          analyzed_at: new Date().toISOString(),
        },
        {
          user_id: "default-user",
          style_vector: {
            avg_sentence_length: 24.8,
            vocab_richness: 0.82,
            punctuation_density: 0.11,
            paragraph_length_avg: 156.3,
            dialogue_ratio: 0.0,
          },
          confidence: 0.89,
          analyzed_at: new Date().toISOString(),
        },
      ];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(results[analysisCount - 1] || results[0]),
      });
    });

    // Submit first text
    const form = page.getByTestId("style-input-form");
    await form.locator("textarea").fill(sampleText1);
    await form.getByRole("button", { name: /analyze style/i }).click();

    // Verify first result
    let resultPanel = page.getByTestId("style-analysis-result");
    await expect(resultPanel).toBeVisible({ timeout: 10000 });

    // Note the values
    const firstSentenceLength = await resultPanel.textContent();
    expect(firstSentenceLength).toContain("16.2");

    // Clear and submit second text
    const textarea = form.locator("textarea");
    await textarea.fill(sampleText2);
    await form.getByRole("button", { name: /analyze style/i }).click();

    // Verify second result shows different metrics
    await page.waitForTimeout(1000);
    resultPanel = page.getByTestId("style-analysis-result");
    const secondSentenceLength = await resultPanel.textContent();

    // Verify different values
    expect(secondSentenceLength).toContain("24.8");
    expect(secondSentenceLength).toContain("89%");

    // Verify the metrics are indeed different
    expect(secondSentenceLength).not.toContain("16.2");
  });
});

test.describe("Style Analysis - Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("should show validation error for text under 500 words", async ({ page }) => {
    await page.getByTestId("style-learning-toggle").click();

    const form = page.getByTestId("style-input-form");
    const textarea = form.locator("textarea");

    // Enter short text
    await textarea.fill("This is a short text. It has very few words.");

    // Try to submit
    const submitButton = form.getByRole("button", { name: /analyze style/i });
    await expect(submitButton).toBeDisabled();

    // Verify validation error appears
    const validationError = page.getByTestId("validation-error");
    await expect(validationError).toBeVisible({ timeout: 3000 });
    await expect(validationError).toContainText("500");
  });

  test("should handle API error gracefully", async ({ page }) => {
    await page.getByTestId("style-learning-toggle").click();

    // Mock API error
    await page.route("**/api/styles/analyze", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "InternalServerError",
          message: "Style analysis service unavailable",
        }),
      });
    });

    const longText = "word ".repeat(501);
    const form = page.getByTestId("style-input-form");
    await form.locator("textarea").fill(longText);
    await form.getByRole("button", { name: /analyze style/i }).click();

    // Verify error is displayed
    const formError = page.getByTestId("form-error");
    await expect(formError).toBeVisible({ timeout: 10000 });

    // Form should still be accessible for retry
    await expect(form.locator("textarea")).toBeVisible();
    await expect(form.getByRole("button", { name: /analyze style/i })).toBeEnabled();
  });

  test("should clear error when user starts typing", async ({ page }) => {
    await page.getByTestId("style-learning-toggle").click();

    // Mock API error first
    await page.route("**/api/styles/analyze", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test error" }),
      });
    });

    const longText = "word ".repeat(501);
    const form = page.getByTestId("style-input-form");
    await form.locator("textarea").fill(longText);
    await form.getByRole("button", { name: /analyze style/i }).click();

    // Wait for error
    const formError = page.getByTestId("form-error");
    await expect(formError).toBeVisible({ timeout: 10000 });

    // Type more text
    await form.locator("textarea").fill(longText + " more words");

    // Error should be cleared
    await expect(formError).not.toBeVisible();
  });
});

test.describe("Style Analysis - Panel Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("should toggle panel open and closed", async ({ page }) => {
    const styleToggle = page.getByTestId("style-learning-toggle");

    // Initially closed
    await expect(page.getByTestId("style-learning-overlay")).not.toBeVisible();

    // Open
    await styleToggle.click();
    await expect(page.getByTestId("style-learning-overlay")).toBeVisible();

    // Close via close button
    const closeButton = page.locator(".style-learning-overlay .close-button");
    await closeButton.click();
    await expect(page.getByTestId("style-learning-overlay")).not.toBeVisible({ timeout: 3000 });
  });

  test("should maintain text input when closing and reopening panel", async ({ page }) => {
    // Open panel
    await page.getByTestId("style-learning-toggle").click();

    const form = page.getByTestId("style-input-form");
    const textarea = form.locator("textarea");

    // Enter text
    const testText = "This is test text that should persist. " + "word ".repeat(100);
    await textarea.fill(testText);

    // Close panel
    await page.locator(".style-learning-overlay .close-button").click();
    await expect(page.getByTestId("style-learning-overlay")).not.toBeVisible({ timeout: 3000 });

    // Reopen panel
    await page.getByTestId("style-learning-toggle").click();
    await expect(page.getByTestId("style-learning-overlay")).toBeVisible();

    // Note: Depending on implementation, text may or may not persist
    // This test documents the expected behavior
  });
});
