// Home page hero photos. Order is shuffled at module load (once per
// build), so each deploy ships a different first/LCP image. The five
// candidates are visually similar enough that any one works as the
// hero — the rotation script in home.njk cycles through 2-5 after LCP.
const heroes = [
  {
    src: "/images/home/region13_home_1.jpg",
    alt: "Region 13 girls in green and black uniforms celebrate together on the field",
  },
  {
    src: "/images/home/region13_home_2.jpg",
    alt: "Two Region 13 teammates in lime green uniforms hug after a play",
  },
  {
    src: "/images/home/region13_home_3.jpg",
    alt: "Region 13 boys in red and black uniforms walk off the field with a referee",
  },
  {
    src: "/images/home/region13_home_4.jpg",
    alt: "A Region 13 player in a red and black uniform chases the ball during a game",
  },
  {
    src: "/images/home/region13_home_5.jpg",
    alt: "Region 13 teammates in navy uniforms celebrate after a goal",
  },
];

// Fisher-Yates shuffle. Runs once per Eleventy build.
for (let i = heroes.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [heroes[i], heroes[j]] = [heroes[j], heroes[i]];
}

module.exports = heroes;
