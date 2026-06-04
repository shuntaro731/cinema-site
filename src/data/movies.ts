import mandalorianMp4 from '../assets/video/mandalorian.mp4?url';
import marioMp4 from '../assets/video/mario.mp4?url';
import pradaMp4 from '../assets/video/prada2.mp4?url';
import mandalorianMovieImage from '../assets/movie-image/mandalorian.jpg?url';
import marioMovieImage from '../assets/movie-image/mario.jpg?url';
import pradaMovieImage from '../assets/movie-image/prada.jpg?url';
import mandalorianLogoImage from '../assets/movie-logo/mandalorian.png?url';
import marioLogoImage from '../assets/movie-logo/mario.png?url';
import pradaLogoImage from '../assets/movie-logo/prada.png?url';
import type { VideoSource } from '../types/video';

type ScreeningSchedule = {
	day: string;
	date: string;
	month: string;
	showings: {
		format: string;
		time: string;
	}[];
};

export type FeaturedMovie = {
	id: number;
	title: string;
	description: string;
	fallbackImage: string;
	logoImage: string;
	durationMinutes: number;
	imdbRating: number;
	storyline: string[];
	schedule: ScreeningSchedule[];
	teaserSources?: VideoSource[];
	teaserZoom?: number;
};

// それぞれの動画をリストで管理してプロップスで渡す
export const featuredMovies: FeaturedMovie[] = [
	{
		id: 1,
		title: 'ザ・スーパーマリオブラザーズ・ムービー',
		description: 'ゲームの世界を飛び出した兄弟が、きらびやかな王国を舞台に冒険へ踏み出すファミリーアドベンチャー。',
		durationMinutes: 93,
		imdbRating: 7.0,
		storyline: [
			'ニューヨークで配管工として働くマリオとルイージは、地下の不思議な土管を通って別々の世界へ迷い込む。マリオはピーチ姫と出会い、クッパにさらわれたルイージを救うため、キノコ王国を舞台に大きな冒険へ踏み出す。',
			'ゲームでおなじみの世界観を鮮やかな映像で描き、家族で楽しめるテンポのよいアクションとコミカルなキャラクターが魅力の作品です。',
		],
		// 上映スケジュール
		schedule: [
			{ day: '月', date: '17', month: '6月', showings: [{ format: '2D', time: '11:30' }, { format: '3D', time: '13:00' }, { format: '2D', time: '17:00' }, { format: 'IMAX 3D', time: '19:45' }, { format: 'IMAX', time: '21:45' }] },
			{ day: '火', date: '18', month: '6月', showings: [{ format: '2D', time: '10:30' }, { format: '3D', time: '13:10' }, { format: 'IMAX', time: '16:20' }, { format: '2D', time: '19:00' }, { format: 'IMAX 3D', time: '22:10' }] },
			{ day: '水', date: '19', month: '6月', showings: [{ format: '2D', time: '10:45' }, { format: '3D', time: '12:50' }, { format: 'IMAX', time: '16:30' }, { format: '2D', time: '18:40' }, { format: 'IMAX 3D', time: '21:20' }] },
			{ day: '木', date: '20', month: '6月', showings: [{ format: '2D', time: '11:00' }, { format: '3D', time: '14:20' }, { format: 'IMAX', time: '17:30' }, { format: 'IMAX 3D', time: '20:10' }, { format: '2D', time: '22:35' }] },
			{ day: '金', date: '21', month: '6月', showings: [{ format: '2D', time: '12:00' }, { format: '3D', time: '14:40' }, { format: 'IMAX', time: '18:00' }, { format: '2D', time: '20:20' }, { format: 'IMAX', time: '21:30' }] },
			{ day: '土', date: '22', month: '6月', showings: [{ format: '2D', time: '10:20' }, { format: '3D', time: '13:00' }, { format: 'IMAX', time: '16:10' }, { format: '2D', time: '19:30' }, { format: 'IMAX 3D', time: '21:45' }] },
			{ day: '日', date: '23', month: '6月', showings: [{ format: '2D', time: '11:30' }, { format: '3D', time: '14:00' }, { format: 'IMAX', time: '17:20' }, { format: '2D', time: '20:00' }, { format: 'IMAX', time: '22:30' }] },
		],
		// 動画が表示されない時の予備
		fallbackImage: marioMovieImage,
		logoImage: marioLogoImage,
		teaserSources: [
			{ src: marioMp4, type: 'video/mp4' },
		],
	},
	{
		id: 2,
		title: 'スターウォーズ | マンダロリアン',
		description: '銀河の辺境を旅する賞金稼ぎと小さな相棒の行く先を描く、重厚なスペースアクション。',
		durationMinutes: 120,
		imdbRating: 8.6,
		storyline: [
			'帝国崩壊後の混乱が続く銀河の辺境で、孤高の賞金稼ぎマンダロリアンは、任務の途中で小さな子どもと出会う。その出会いは、彼の生き方と銀河の勢力図を大きく変えていく。',
			'西部劇のような緊張感とスターウォーズらしい壮大な世界観が重なり、静かなドラマと迫力あるアクションを同時に楽しめる作品です。',
		],
		schedule: [
			{ day: '月', date: '17', month: '6月', showings: [{ format: '2D', time: '12:20' }, { format: 'IMAX', time: '15:00' }, { format: '2D', time: '17:50' }, { format: 'IMAX 3D', time: '20:10' }, { format: '2D', time: '22:20' }] },
			{ day: '火', date: '18', month: '6月', showings: [{ format: '2D', time: '10:40' }, { format: 'IMAX 3D', time: '15:00' }, { format: 'IMAX', time: '18:20' }, { format: '2D', time: '20:40' }, { format: 'IMAX', time: '22:50' }] },
			{ day: '水', date: '19', month: '6月', showings: [{ format: '2D', time: '11:00' }, { format: 'IMAX', time: '14:10' }, { format: '2D', time: '17:40' }, { format: 'IMAX', time: '19:20' }, { format: 'IMAX 3D', time: '22:10' }] },
			{ day: '木', date: '20', month: '6月', showings: [{ format: '2D', time: '10:30' }, { format: 'IMAX', time: '13:20' }, { format: 'IMAX 3D', time: '16:10' }, { format: '2D', time: '19:40' }, { format: 'IMAX', time: '21:50' }] },
			{ day: '金', date: '21', month: '6月', showings: [{ format: '2D', time: '13:40' }, { format: 'IMAX', time: '16:30' }, { format: 'IMAX 3D', time: '18:50' }, { format: '2D', time: '20:20' }, { format: 'IMAX', time: '21:10' }] },
			{ day: '土', date: '22', month: '6月', showings: [{ format: '2D', time: '11:10' }, { format: 'IMAX 3D', time: '14:30' }, { format: 'IMAX', time: '17:20' }, { format: '2D', time: '20:00' }, { format: '2D', time: '22:20' }] },
			{ day: '日', date: '23', month: '6月', showings: [{ format: '2D', time: '10:50' }, { format: 'IMAX', time: '13:50' }, { format: 'IMAX 3D', time: '16:40' }, { format: '2D', time: '18:30' }, { format: 'IMAX', time: '20:00' }] },
		],
		fallbackImage: mandalorianMovieImage,
		logoImage: mandalorianLogoImage,
		teaserSources: [
			{ src: mandalorianMp4, type: 'video/mp4' },
		],
	},
	{
		id: 3,
		title: 'プラダを着た悪魔2',
		description: '一流ファッション誌の編集部で働き始めた若きアシスタントが、自分らしいキャリアを見つめ直すドラマ。',
		durationMinutes: 106,
		imdbRating: 7.1,
		storyline: [
			'華やかなファッション業界でキャリアを積んだアンディは、新しい時代のメディアと自分の働き方に向き合うことになる。かつての上司ミランダとの再会は、彼女にもう一度大きな選択を迫る。',
			'仕事への憧れ、責任、そして自分らしさのバランスを描く、都会的でテンポのよいヒューマンドラマです。',
		],
		schedule: [
			{ day: '月', date: '17', month: '6月', showings: [{ format: '2D', time: '10:30' }, { format: '3D', time: '13:20' }, { format: '2D', time: '18:00' }, { format: 'IMAX', time: '20:40' }, { format: '2D', time: '22:00' }] },
			{ day: '火', date: '18', month: '6月', showings: [{ format: '2D', time: '11:40' }, { format: '3D', time: '13:30' }, { format: 'IMAX', time: '16:50' }, { format: '2D', time: '19:10' }, { format: 'IMAX', time: '20:00' }] },
			{ day: '水', date: '19', month: '6月', showings: [{ format: '2D', time: '12:10' }, { format: '3D', time: '15:00' }, { format: '2D', time: '17:40' }, { format: 'IMAX', time: '20:30' }, { format: '3D', time: '22:10' }] },
			{ day: '木', date: '20', month: '6月', showings: [{ format: '2D', time: '10:50' }, { format: '3D', time: '13:40' }, { format: '2D', time: '15:20' }, { format: 'IMAX', time: '18:30' }, { format: '2D', time: '21:40' }] },
			{ day: '金', date: '21', month: '6月', showings: [{ format: '2D', time: '11:30' }, { format: '3D', time: '14:20' }, { format: 'IMAX', time: '19:30' }, { format: '2D', time: '21:00' }, { format: '2D', time: '22:00' }] },
			{ day: '土', date: '22', month: '6月', showings: [{ format: '2D', time: '10:10' }, { format: '3D', time: '12:40' }, { format: 'IMAX', time: '16:20' }, { format: '2D', time: '18:40' }, { format: 'IMAX', time: '21:20' }] },
			{ day: '日', date: '23', month: '6月', showings: [{ format: '2D', time: '11:20' }, { format: '3D', time: '14:10' }, { format: 'IMAX', time: '16:50' }, { format: '3D', time: '18:50' }, { format: '2D', time: '21:30' }] },
		],
		fallbackImage: pradaMovieImage,
		logoImage: pradaLogoImage,
		teaserSources: [
			{ src: pradaMp4, type: 'video/mp4' },
		],
	},
];
