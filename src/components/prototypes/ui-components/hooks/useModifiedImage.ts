import { useState, useEffect } from "react";
import tinycolor from "tinycolor2";

type Props = {
  imageUrl: string;
  blendColor: string;
  width: number;
  height: number;
};

//const canvas = document.createElement("canvas");
var canvas: HTMLCanvasElement;
if(typeof document !== 'undefined') {
  canvas = document.createElement("canvas");
}

const useModifiedImage = ({ imageUrl, blendColor, width, height }: Props) => {
  const [modifiedImageUrl, setModifiedImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blendColor) {
      setModifiedImageUrl(imageUrl);
      return;
    }

    // To have better quality, we render the image at 3x the size
    const renderWidth = width * 3;
    const renderHeight = height * 3;

    const rgb = tinycolor(blendColor).toRgb();
    const color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageUrl;
    image.onload = event => {
      if (!image.complete) {
        console.error(`Failed to load image: ${imageUrl}`, event);
        setLoading(false);
        return;
      }

      // Convert the canvas to a data URL
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setLoading(false);
        return;
      }

      ctx.clearRect(0, 0, renderWidth, renderHeight);
      ctx.drawImage(image, 0, 0, renderWidth, renderHeight);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(image, 0, 0, renderWidth, renderHeight);

      setModifiedImageUrl(canvas.toDataURL());
      setLoading(false);
    };

    image.onerror = (event: string | Event) => {
      console.error(`Failed to load image: ${imageUrl}`, event);
      setLoading(false);
    };

    setLoading(true);
  }, [imageUrl, blendColor, width, height]);

  return { modifiedImageUrl, loading };
};

export default useModifiedImage;
