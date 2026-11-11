<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['admin', 'manager', 'staff'] as $r) {
            Role::firstOrCreate(['name' => $r, 'guard_name' => 'web']);
        }

        $users = [
            ['Admin', 'admin@smartdocs.test', 'Admin@12345', 'admin'],
            ['Manager', 'manager@smartdocs.test', 'Manager@12345', 'manager'],
            ['Staff', 'staff@smartdocs.test', 'Staff@12345', 'staff'],
        ];

        foreach ($users as [$name, $email, $pass, $role]) {
            $u = User::firstOrCreate(['email' => $email], ['name' => $name, 'password' => $pass]);
            $u->syncRoles([$role]);
        }
    }
}
