<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title', 'description', 'category', 'organization', 'status', 'path',
        'original_name', 'mime_type', 'size', 'file_hash', 'uploaded_by',
    ];

    protected $hidden = ['path'];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
