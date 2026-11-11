<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'action', 'description', 'ip'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
