export type CustomMigration = {
    id: string;
    description: string;
    run: () => Promise<void>;
};
