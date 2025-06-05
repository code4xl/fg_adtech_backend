export interface ISeeder {
  /**
   * Get the name of the module/table this seeder handles
   */
  getModuleName(): string;

  /**
   * Get the names of dependent modules that should be seeded before this one
   */
  getDependencies(): string[];

  /**
   * Execute the seeding logic for this module
   */
  seed(): Promise<void>;

  /**
   * Clean data for this module
   */
  clean(): Promise<void>;

  /**
   * Check if module has been seeded
   */
  isSeeded(): Promise<boolean>;
  seed(count?: number): Promise<void>; // Add this to the interface
}
