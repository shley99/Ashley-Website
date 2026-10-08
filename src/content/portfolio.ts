export const portfolio = {
  name: 'Ashley Naoko',
  title: 'Creative portfolio',
  description: 'A lifelong creative exploring art in all its forms. Editorial design, illustration, video, printmaking, and hands-on making by Ashley Naoko.',
  email: 'ashfagan99@gmail.com',
  phone: '+1 831-578-8657',
  phoneHref: 'tel:+18315788657',
  youtube: 'https://www.youtube.com/@ashleynaoko',
  // Header "Shop" button link. The button stays hidden until this is set to a real https:// address.
  shop: '',
  about: [
    "I'm a lifelong creative who loves exploring art in all its forms. With experience as an art teacher, I bring organization, patience, and a strong emphasis on safety.",
    'I have an educational background in Business Marketing and am a confident writer with experience in content creation, including promotional videos, mailers, and newsletters.',
    'Outside of my professional work, I enjoy creative hobbies like cooking, baking, snowboarding, and insect pinning.',
  ],
  editorial: 'Written, translated, edited, and designed by me, these monthly newsletters were a way to promote cross-cultural learning for a rural Japan town I lived in. I made sure to provide translations for beginner English learners, as well as adjust the English to be more understandable for intermediate and advanced English learners.',
  testimonial: {
    quote: "Working with her on my student-written newsletter JUST KID'N was a great experience. She brought a strong artistic eye and completely elevated its design. What started as a minimal, fairly plain layout became expressive and engaging without overpowering the students' content.",
    author: 'Jill Kleiss',
    role: 'Nationally Published Writer',
  },
  graphic: 'From Christmas cards to stickers for a Japanese messaging app, I take art commissions of all kinds. These stickers can still be purchased on the LINE App.',
  video: [
    'I began video editing in high school while working on school projects and quickly grew to love the meticulous, time-intensive process. From school projects, I moved on to short-form content and YouTube videos.',
    'I also spent months digitizing over 200 family 8mm tapes. I then carefully reviewed the footage and edited a two-hour compilation highlighting the most meaningful moments.',
  ],
  japan: 'I documented my time living in Japan by filming and editing vlogs so that my family back home could see what I was up to. Video editing allows me to combine my sense of humor with a creative eye for composition and visually compelling shots.',
  printing: "My interest in 3D printing began with a 3D printing pen gifted to me by my mother. Starting with manual, hands-on experimentation, I eventually progressed to using a Bambu Lab A1 3D printer. I design and create everything from playful objects to functional, practical solutions, developing original models in TinkerCAD and producing prints from open-source platforms such as MakerWorld. I've developed a strong understanding in troubleshooting and maintaining 3D printers, from print failures to calibration and hardware issues.",
  laser: 'I have years of hands-on experience with the WeCreat Vision 40W laser, the xTool F1 laser, xTool P3 laser, and the 3018-PROVer CNC router. Each system includes design software that I was able to learn quickly. Mastering layered designs and fine-tuning settings for different materials presented a steep learning curve, but I welcomed the opportunity to grow.',
  printmaking: "Hand-carving linoleum blocks and rubber stamps has become one of my primary creative outlets. Developing original designs and exploring the relationship between foreground and background elements is both challenging and fulfilling. I've conducted stamp-carving workshops for young artists and taken part in community events where children used my holiday-themed stamps to design their own greeting cards.",
  welding: 'I began learning arc welding in high school and later expanded into MIG and TIG welding under the mentorship of my father. Combining these technical skills with my passion for jewelry making and sustainability, I designed and built a wind-powered rock tumbler that transforms broken glass into smooth, frosted "beach glass."',
  tumblerNotes: [
    'Aluminum sheets were attached to a recycled AC fan.',
    'My old bike was sacrificed so I could use the chain and gear.',
    'Old paint buckets filled with sand from my backyard sandbox slowly polished the glass.',
  ],
} as const;

export const stickers = [
  ['sticker-nuts', 'Cartoon aardvark saying "That\'s nuts!"'],
  ['sticker-confused', 'Confused character surrounded by question marks'],
  ['sticker-cat', 'Grey cat saying "Um... OK..."'],
  ['sticker-bye', 'Yellow character saying "Bye"'],
  ['sticker-so-full', 'Contented character saying "So full"'],
  ['sticker-bangin', 'Long-eared character saying "Totally bangin\'!"'],
  ['sticker-listening', 'Character saying "I\'m listening"'],
  ['sticker-yo', 'Illustrated character saying "Yo"'],
  ['sticker-surprised', 'Surprised, wide-eyed character'],
] as const;
