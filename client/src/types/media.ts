export type MediaFile = {
    id: string;
    name: string;
    type: "image" | "video";
    date: string;
    size: number;
    isAnimated: boolean;
};
