-- seed.sql
-- Achievement definitions for the SpeakFlow gamification system

INSERT INTO achievement_definitions (slug, title, description, icon_url, category, threshold, xp_reward, sort_order)
VALUES
    (
        'first_lesson',
        'First Step',
        'Complete your very first lesson',
        '/achievements/first_lesson.svg',
        'lessons',
        1,
        50,
        1
    ),
    (
        'regular_10',
        'Regular Student',
        'Complete 10 lessons',
        '/achievements/regular_10.svg',
        'lessons',
        10,
        200,
        2
    ),
    (
        'dedicated_50',
        'Dedicated Learner',
        'Complete 50 lessons',
        '/achievements/dedicated_50.svg',
        'lessons',
        50,
        1000,
        3
    ),
    (
        'streak_7',
        'Weekly Warrior',
        'Maintain a 7-day lesson streak',
        '/achievements/streak_7.svg',
        'streak',
        7,
        150,
        4
    ),
    (
        'streak_30',
        'Unstoppable',
        'Maintain a 30-day lesson streak',
        '/achievements/streak_30.svg',
        'streak',
        30,
        500,
        5
    ),
    (
        'polyglot_b2',
        'Polyglot',
        'Reach B2 English proficiency level',
        '/achievements/polyglot_b2.svg',
        'milestone',
        1,
        750,
        6
    ),
    (
        'social_5_reviews',
        'Helpful Critic',
        'Leave 5 reviews for your teachers',
        '/achievements/social_5_reviews.svg',
        'social',
        5,
        100,
        7
    ),
    (
        'bookworm_10_homework',
        'Bookworm',
        'Complete 10 homework assignments',
        '/achievements/bookworm_10_homework.svg',
        'milestone',
        10,
        300,
        8
    );
