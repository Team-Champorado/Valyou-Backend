declare module 'shapefile' {
    export function open(path: string, options?: any): Promise<Source>;
    export function read(path: string, options?: any): Promise<any>;

    interface Source {
        read(): Promise<{ done: boolean; value: any }>;
    }
}
