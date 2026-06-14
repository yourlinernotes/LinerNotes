import { prisma } from '../src/lib/prisma';

async function exportReviews() {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        user: true,
        notes: {
          orderBy: { createdAt: 'asc' }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const albumReviews = await prisma.albumReview.findMany({
      include: {
        user: true,
        trackReviews: {
          include: {
            notes: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📀 TRACK REVIEWS:\n');
    reviews.forEach((review, i) => {
      console.log(`${i + 1}. ${review.trackName} by ${review.trackArtist}`);
      console.log(`   Album: ${review.trackAlbum}`);
      console.log(`   Rating: ${review.rating}/5`);
      console.log(`   Take: ${review.take || '(none)'}`);
      console.log(`   Reaction: ${review.reaction || '(none)'}`);

      if (review.notes.length > 0) {
        console.log(`   Notes:`);
        review.notes.forEach((note, j) => {
          const minutes = Math.floor(note.seconds / 60);
          const secs = Math.floor(note.seconds % 60);
          const timestamp = `${minutes}:${secs.toString().padStart(2, '0')}`;
          console.log(`     [${timestamp}] ${note.label} - ${note.note || '(no note)'}`);
        });
      }
      console.log('');
    });

    console.log('\n💿 ALBUM REVIEWS:\n');
    albumReviews.forEach((review, i) => {
      console.log(`${i + 1}. ${review.albumName} by ${review.albumArtist}`);
      console.log(`   Overall: ${review.overallRating}/5`);
      console.log(`   Take: ${review.take || '(none)'}`);
      console.log(`   Tracks reviewed: ${review.trackReviews.length}`);

      review.trackReviews.forEach((track) => {
        console.log(`   - ${track.trackName}: ${track.reaction || 'no reaction'}`);
        if (track.notes.length > 0) {
          track.notes.forEach((note) => {
            const minutes = Math.floor(note.seconds / 60);
            const secs = Math.floor(note.seconds % 60);
            const timestamp = `${minutes}:${secs.toString().padStart(2, '0')}`;
            console.log(`     [${timestamp}] ${note.label}`);
          });
        }
      });
      console.log('');
    });

    console.log(`\nTotal reviews: ${reviews.length} tracks, ${albumReviews.length} albums\n`);

    // Also export as JSON for design reference
    const exportData = {
      trackReviews: reviews.map(r => ({
        track: {
          name: r.trackName,
          artist: r.trackArtist,
          album: r.trackAlbum,
          artworkUrl: r.artworkUrl,
        },
        rating: r.rating,
        take: r.take,
        reaction: r.reaction,
        notes: r.notes.map(n => ({
          seconds: n.seconds,
          timestamp: `${Math.floor(n.seconds / 60)}:${Math.floor(n.seconds % 60).toString().padStart(2, '0')}`,
          label: n.label,
          note: n.note,
        })),
      })),
      albumReviews: albumReviews.map(r => ({
        album: {
          name: r.albumName,
          artist: r.albumArtist,
          artworkUrl: r.artworkUrl,
        },
        overallRating: r.overallRating,
        take: r.take,
        tracks: r.trackReviews.map(t => ({
          name: t.trackName,
          reaction: t.reaction,
          notes: t.notes.map(n => ({
            seconds: n.seconds,
            timestamp: `${Math.floor(n.seconds / 60)}:${Math.floor(n.seconds % 60).toString().padStart(2, '0')}`,
            label: n.label,
            note: n.note,
          })),
        })),
      })),
    };

    const fs = await import('fs');
    fs.writeFileSync(
      'review-data-for-design.json',
      JSON.stringify(exportData, null, 2)
    );

    console.log('✅ Exported to: review-data-for-design.json\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportReviews();
