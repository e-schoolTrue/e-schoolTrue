import { MigrationInterface, QueryRunner, TableUnique } from "typeorm";

export class RemoveUniqueConstraintFromTranchConfig1727000000000 implements MigrationInterface {
    name = 'RemoveUniqueConstraintFromTranchConfig1727000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("tranch_config");
        const uniqueConstraint = table.uniques.find(u => {
            return u.columnNames.length === 1 && u.columnNames.includes("paymentAnnualConfigId");
        });

        if (uniqueConstraint) {
            await queryRunner.dropUniqueConstraint("tranch_config", uniqueConstraint);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createUniqueConstraint("tranch_config", new TableUnique({
            columnNames: ["paymentAnnualConfigId"]
        }));
    }
}
