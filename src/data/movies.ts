export type FeaturedMovie = {
	id: number;
	teaserUrl?: string;
};

export const featuredMovies: FeaturedMovie[] = [
	{
		id: 603,
		teaserUrl: '/videos/matrix-teaser.mp4',
	},
	{
		id: 155,
		teaserUrl: '/videos/dark-knight-teaser.mp4',
	},
	{
		id: 129,
		teaserUrl: '/videos/spirited-away-teaser.mp4',
	},
];
