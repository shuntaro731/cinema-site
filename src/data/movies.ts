import mandalorianMp4 from '../assets/video/mandalorian.mp4?url';
import marioMp4 from '../assets/video/mario.mp4?url';
import pradaMp4 from '../assets/video/prada2.mp4?url';
import mandalorianMovieImage from '../assets/movie-image/mandalorian.jpg?url';
import marioMovieImage from '../assets/movie-image/mario.jpg?url';
import pradaMovieImage from '../assets/movie-image/prada.jpg?url';

type FeaturedMovieVideoSource = {
	src: string;
	type: string;
};

export type FeaturedMovie = {
	id: number;
	title: string;
	description: string;
	movieImage: string;
	teaserSources?: FeaturedMovieVideoSource[];
	teaserZoom?: number;
};

// それぞれの動画をリストで管理してプロップスで渡す
export const featuredMovies: FeaturedMovie[] = [
	{
		id: 1,
		title: 'ザ・スーパーマリオブラザーズ・ムービー',
		description: 'ゲームの世界を飛び出した兄弟が、きらびやかな王国を舞台に冒険へ踏み出すファミリーアドベンチャー。',
		// 動画が表示されない時の予備
		movieImage: marioMovieImage,
		teaserSources: [
			{ src: marioMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.02,
	},
	{
		id: 2,
		title: 'スターウォーズ | マンダロリアン',
		description: '銀河の辺境を旅する賞金稼ぎと小さな相棒の行く先を描く、重厚なスペースアクション。',
		movieImage: mandalorianMovieImage,
		teaserSources: [
			{ src: mandalorianMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.02,
	},
	{
		id: 3,
		title: 'プラダを着た悪魔2',
		description: '一流ファッション誌の編集部で働き始めた若きアシスタントが、自分らしいキャリアを見つめ直すドラマ。',
		movieImage: pradaMovieImage,
		teaserSources: [
			{ src: pradaMp4, type: 'video/mp4' },
		],
		teaserZoom: 1.02,
	},
];
