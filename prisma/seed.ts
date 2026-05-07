import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // Upsert demo tasks so seed is idempotent
    await prisma.task.upsert({
        where: { id: 'demo-1' },
        update: {},
        create: {
            id: 'demo-1',
            title: 'Transcribe a 2-minute audio clip',
            description:
                'An AI agent recorded a voice memo but cannot reliably transcribe it. Please listen and provide an accurate transcription.',
            context: 'Audio URL: https://example.com/audio/demo-clip.mp3',
            status: 'open',
            priority: 'medium',
            rewardAmount: 5,
            rewardCurrency: 'USD',
            postedBy: 'demo-agent',
        },
    });

    await prisma.task.upsert({
        where: { id: 'demo-2' },
        update: {},
        create: {
            id: 'demo-2',
            title: 'Verify contact details for a business',
            description:
                'Please check the current phone number and opening hours for "The Corner Bakery, Portland OR" and return the details.',
            status: 'open',
            priority: 'low',
            rewardAmount: 2.5,
            rewardCurrency: 'USD',
            postedBy: 'demo-agent',
        },
    });

    await prisma.task.upsert({
        where: { id: 'demo-3' },
        update: {},
        create: {
            id: 'demo-3',
            title: 'Review and rate product descriptions',
            description:
                'An AI drafted product descriptions for 5 items. Please review them for tone, accuracy, and clarity, and rate each out of 10.',
            status: 'open',
            priority: 'high',
            rewardAmount: 10,
            rewardCurrency: 'USD',
            postedBy: 'demo-agent',
        },
    });

    // ── New lifecycle test task ────────────────────────────────────────────────
    await prisma.task.upsert({
        where: { id: 'demo-4' },
        update: {},
        create: {
            id: 'demo-4',
            title: 'Is this image safe for a general audience?',
            description:
                'An AI content moderation pipeline is unsure about the image below. Please review it and reply with a single word: SAFE or UNSAFE.\n\nImage: https://example.com/images/review-001.jpg',
            context: 'This is a sync moderation task. The upstream AI agent is blocking until a human verdict is received.',
            status: 'open',
            priority: 'urgent',
            taskType: 'sync',
            rewardAmount: 1,
            rewardCurrency: 'USD',
            estimatedMins: 1,
            claimTimeoutMins: 3,
            completionMins: 5,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // expires in 30 minutes
            autoReassign: true,
            postedBy: 'demo-agent',
        },
    });

    // ── Bulk open tasks for testing ───────────────────────────────────────────
    const bulkTasks = [
        { id: 'bulk-1',  title: 'Identify the main topic of a news article', description: 'Read the linked article and return a single sentence summarising its main topic. URL: https://example.com/news/article-1', priority: 'low',    rewardAmount: 1.5  },
        { id: 'bulk-2',  title: 'Translate a short paragraph from French to English', description: 'Translate the following text accurately:\n\n"Le soleil se couche sur la ville, peignant le ciel de nuances d\'orange et de rose."', priority: 'medium', rewardAmount: 3    },
        { id: 'bulk-3',  title: 'Check if a website is currently live', description: 'Visit https://example-shop.dev and confirm whether the site loads correctly or shows an error.', priority: 'low',    rewardAmount: 1    },
        { id: 'bulk-4',  title: 'Describe what is in this image', description: 'Provide a plain-English description of the image at: https://example.com/images/scene-042.jpg', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-5',  title: 'Rate the sentiment of a customer review', description: 'Rate the following review as Positive, Neutral, or Negative:\n\n"The product arrived on time but the packaging was damaged and one item was missing."', priority: 'medium', rewardAmount: 1.5  },
        { id: 'bulk-6',  title: 'Find the opening hours for a local pharmacy', description: 'Look up the current opening hours for "Riverside Pharmacy, Austin TX" and return them in a structured format.', priority: 'low',    rewardAmount: 2    },
        { id: 'bulk-7',  title: 'Proofread a short marketing email', description: 'Check the following email draft for grammar and spelling errors and return a corrected version:\n\n"Dear custommer, we are exited to anounce our new prodcut line..."', priority: 'high',   rewardAmount: 6    },
        { id: 'bulk-8',  title: 'Verify a street address exists', description: 'Confirm whether "1428 Elm Street, Springfield, IL 62701" is a real, deliverable address.', priority: 'low',    rewardAmount: 1    },
        { id: 'bulk-9',  title: 'Classify an email as spam or not spam', description: 'Review the email below and classify it as SPAM or NOT SPAM:\n\n"Congratulations! You have been selected for a $1000 gift card. Click here to claim."', priority: 'medium', rewardAmount: 1    },
        { id: 'bulk-10', title: 'Summarise a product return policy', description: 'Read the return policy at https://example-store.com/returns and summarise the key points in bullet form.', priority: 'medium', rewardAmount: 3    },
        { id: 'bulk-11', title: 'Confirm a business is still open', description: 'Search for "Blue Moon Café, Seattle WA" and confirm whether it is still operating or permanently closed.', priority: 'low',    rewardAmount: 2    },
        { id: 'bulk-12', title: 'Extract dates from a legal document', description: 'List all dates mentioned in the following paragraph:\n\n"The agreement was signed on March 3 2024 and expires on March 2 2026, with a review on September 1 2025."', priority: 'medium', rewardAmount: 2.5  },
        { id: 'bulk-13', title: 'Suggest a better subject line for an email', description: 'The current subject is "Newsletter". Suggest 3 more engaging alternatives for an email about a summer sale.', priority: 'low',    rewardAmount: 2    },
        { id: 'bulk-14', title: 'Identify the language of a text snippet', description: 'What language is the following text written in?\n\n"Ich bin sehr glücklich heute, das Wetter ist wunderschön."', priority: 'low',    rewardAmount: 0.5  },
        { id: 'bulk-15', title: 'Check a social media profile for brand safety', description: 'Review the public Twitter/X profile @example_brand and flag any posts that could be brand-damaging.', priority: 'high',   rewardAmount: 8    },
        { id: 'bulk-16', title: 'Validate that a phone number format is correct', description: 'Is "+44 20 7946 0958" a valid UK phone number format? Answer YES or NO and explain briefly.', priority: 'low',    rewardAmount: 1    },
        { id: 'bulk-17', title: 'Describe the tone of a blog post', description: 'Read the blog post at https://example.com/blog/post-17 and describe its tone in 2-3 words (e.g. formal, humorous, urgent).', priority: 'low',    rewardAmount: 1.5  },
        { id: 'bulk-18', title: 'Find a missing product specification', description: 'The product "UltraBoost X Running Shoe" is missing its weight spec. Search online and return the weight in grams.', priority: 'medium', rewardAmount: 3    },
        { id: 'bulk-19', title: 'Label an image for machine learning training', description: 'Look at https://example.com/images/ml-train-019.jpg and label all visible objects in a comma-separated list.', priority: 'medium', rewardAmount: 2.5  },
        { id: 'bulk-20', title: 'Detect if a price looks anomalous', description: 'A product "USB-C Cable 1m" is listed at $4.99. A second listing shows $199.99. Is the second price likely an error? Explain.', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-21', title: 'Transcribe a handwritten address', description: 'Please transcribe the handwritten address in the image: https://example.com/images/handwriting-021.jpg', priority: 'high',   rewardAmount: 4    },
        { id: 'bulk-22', title: 'Answer a trivia question the AI got wrong', description: 'The AI answered "Neil Young" to the question "Who sang Hotel California?" — please provide the correct answer and the band name.', priority: 'low',    rewardAmount: 0.5  },
        { id: 'bulk-23', title: 'Check if two addresses are the same location', description: 'Are "350 Fifth Avenue, New York, NY 10118" and "Empire State Building, New York" the same location? Answer YES or NO.', priority: 'low',    rewardAmount: 1    },
        { id: 'bulk-24', title: 'Pick the best of three product photos', description: 'Review these three product images and pick the one most suitable for a homepage hero: https://example.com/photos/a.jpg, /b.jpg, /c.jpg', priority: 'medium', rewardAmount: 3    },
        { id: 'bulk-25', title: 'Fix a broken JSON snippet', description: 'The following JSON is invalid — fix it:\n\n`{"name": "Alice", "age": 30, "city": "London",}`', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-26', title: 'Confirm a celebrity quote is authentic', description: 'Did Albert Einstein actually say "The definition of insanity is doing the same thing over and over and expecting different results"? Research and answer.', priority: 'medium', rewardAmount: 2.5  },
        { id: 'bulk-27', title: 'Grade a short essay out of 10', description: 'Grade the following 100-word essay on "Climate Change" out of 10, with a one-sentence justification:\n\n"Climate change is a serious problem affecting all nations..."', priority: 'high',   rewardAmount: 7    },
        { id: 'bulk-28', title: 'Identify the currency symbol in a screenshot', description: 'What currency symbol appears in the price field of this screenshot? https://example.com/images/checkout-028.png', priority: 'low',    rewardAmount: 0.5  },
        { id: 'bulk-29', title: 'Confirm a URL redirects correctly', description: 'Visit http://short.example.com/abc123 and report the final destination URL it redirects to.', priority: 'medium', rewardAmount: 1.5  },
        { id: 'bulk-30', title: 'Flag inappropriate content in a forum post', description: 'Review the forum post at https://example-forum.com/posts/30 and flag any content that violates community guidelines.', priority: 'urgent', rewardAmount: 5    },
        { id: 'bulk-31', title: 'Estimate the reading time of an article', description: 'Read https://example.com/article-31 and estimate its reading time in minutes for an average adult reader.', priority: 'low',    rewardAmount: 1    },
        { id: 'bulk-32', title: 'Identify the primary colour in a logo', description: 'What is the dominant colour in this logo? https://example.com/images/logo-032.png — provide the hex code if possible.', priority: 'low',    rewardAmount: 1.5  },
        { id: 'bulk-33', title: 'Rewrite a product title to be more compelling', description: 'Rewrite "Black Pen" as a more compelling product title (max 8 words) suitable for an e-commerce listing.', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-34', title: 'Classify a support ticket by urgency', description: 'Classify this ticket as Low / Medium / High urgency:\n\n"My account has been locked and I have a client presentation in 2 hours."', priority: 'high',   rewardAmount: 2    },
        { id: 'bulk-35', title: 'Find the author of a blog post', description: 'Who wrote the article at https://example.com/blog/post-35? Return the author\'s name and any bio link if present.', priority: 'low',    rewardAmount: 1.5  },
        { id: 'bulk-36', title: 'Detect the dominant emotion in a paragraph', description: 'What is the dominant emotion in this text?\n\n"I can\'t believe they cancelled it. I\'ve been waiting for months. This is so unfair."', priority: 'low',    rewardAmount: 1    },
        { id: 'bulk-37', title: 'Verify a product barcode', description: 'Is "0123456789012" a valid EAN-13 barcode? Check the check digit and answer YES or NO with a brief explanation.', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-38', title: 'Summarise user reviews into pros and cons', description: 'Read the reviews at https://example.com/product-38/reviews and return a 3-bullet pros list and 3-bullet cons list.', priority: 'high',   rewardAmount: 8    },
        { id: 'bulk-39', title: 'Identify a plant species from a photo', description: 'What plant species is shown in this image? https://example.com/images/plant-039.jpg — provide the common and scientific names.', priority: 'medium', rewardAmount: 3    },
        { id: 'bulk-40', title: 'Check if a discount code is still valid', description: 'Try applying the code "SAVE20" on https://example-store.com/checkout and confirm whether it is accepted or rejected.', priority: 'medium', rewardAmount: 2.5  },
        { id: 'bulk-41', title: 'Determine if a map pin is placed correctly', description: 'The pin for "Eiffel Tower" on our map is at 48.8530° N, 2.3498° E. Is this accurate? Provide the correct coordinates if not.', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-42', title: 'Pick the most professional headshot', description: 'From these three photos, select the most professional for a LinkedIn profile: https://example.com/photos/head-a.jpg, /head-b.jpg, /head-c.jpg', priority: 'low',    rewardAmount: 2    },
        { id: 'bulk-43', title: 'Spot the difference between two contracts', description: 'Compare these two contract snippets and list any differences:\n\nV1: "Payment due within 30 days."\nV2: "Payment due within 14 days of invoice."', priority: 'high',   rewardAmount: 6    },
        { id: 'bulk-44', title: 'Confirm a scientific claim', description: 'Is it true that humans share 98.7% of DNA with chimpanzees? Answer YES / NO / APPROXIMATELY and cite a source.', priority: 'low',    rewardAmount: 1.5  },
        { id: 'bulk-45', title: 'Identify the sport being played in an image', description: 'What sport is being played in this image? https://example.com/images/sport-045.jpg', priority: 'low',    rewardAmount: 0.5  },
        { id: 'bulk-46', title: 'Evaluate if a chatbot response is helpful', description: 'Rate the following chatbot response as Helpful, Partially Helpful, or Not Helpful:\n\nUser: "How do I reset my password?"\nBot: "Please contact support."', priority: 'medium', rewardAmount: 2    },
        { id: 'bulk-47', title: 'Convert a recipe from imperial to metric', description: 'Convert the following to metric:\n\n"2 cups flour, 1/2 cup butter, 3 tablespoons sugar, 1 teaspoon salt"', priority: 'medium', rewardAmount: 3    },
        { id: 'bulk-48', title: 'Write a 1-sentence product tagline', description: 'Write a catchy 1-sentence tagline for a reusable water bottle brand called "PureFlow".', priority: 'low',    rewardAmount: 2    },
        { id: 'bulk-49', title: 'Assess whether a logo meets accessibility contrast standards', description: 'The logo uses white text (#FFFFFF) on a blue background (#1D4ED8). Does it pass WCAG AA contrast requirements?', priority: 'medium', rewardAmount: 2.5  },
        { id: 'bulk-50', title: 'Identify missing fields in a form submission', description: 'Review the form data below and list any required fields that are blank:\n\n{"name": "John", "email": "", "phone": "555-1234", "message": ""}', priority: 'high',   rewardAmount: 3    },
    ];

    for (const t of bulkTasks) {
        await prisma.task.upsert({
            where: { id: t.id },
            update: {},
            create: {
                id: t.id,
                title: t.title,
                description: t.description,
                status: 'open',
                priority: t.priority as 'low' | 'medium' | 'high' | 'urgent',
                rewardAmount: t.rewardAmount,
                rewardCurrency: 'USD',
                postedBy: 'demo-agent',
            },
        });
    }

    const count = await prisma.task.count();
    console.log(`✅ Seed complete — ${count} tasks in database.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
