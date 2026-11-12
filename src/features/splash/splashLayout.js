// Where the splash picture goes on a given screen. Pure, so the arithmetic is covered by Jest.
//
// The picture (assets/splash-screen.png) is 841x1870, drawn for a tall phone screen. It is fitted whole inside the
// screen ("contain"), centred, and never cropped or stretched. A screen with the same shape fills completely; a
// screen of a different shape leaves bands, which the overlay fills with the picture's own edge colours.
export const PICTURE = { width: 841, height: 1870 };

// Colours at the top and bottom edges of the picture, measured from the file (the average of the first and last
// rows). The bands above and below the picture use them, so the picture appears to carry on past its edges.
export const EDGE_COLORS = { top: '#1f99fa', bottom: '#eab6e7' };

// Size and position of the picture on a screen of the given size (in the same units as the screen, normally dp).
export function fitSplash(screenWidth, screenHeight) {
  const scale = Math.min(screenWidth / PICTURE.width, screenHeight / PICTURE.height);
  const width = PICTURE.width * scale;
  const height = PICTURE.height * scale;
  return {
    scale,
    width,
    height,
    left: (screenWidth - width) / 2,
    top: (screenHeight - height) / 2,
  };
}
