import { MediaFile } from "./media";

export type FileEvent =
    | { action: "add"; file: MediaFile }
    | { action: "update"; file: MediaFile }
    | { action: "remove"; file: MediaFile };
