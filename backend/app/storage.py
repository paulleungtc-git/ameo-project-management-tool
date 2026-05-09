from typing import BinaryIO

import boto3
from botocore.config import Config

from app.core.config import get_settings


class ObjectStorage:
    def put_file(self, key: str, body: BinaryIO, content_type: str) -> None:
        raise NotImplementedError


class S3ObjectStorage(ObjectStorage):
    def __init__(self) -> None:
        settings = get_settings()
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(s3={"addressing_style": "path"}),
        )

    def put_file(self, key: str, body: BinaryIO, content_type: str) -> None:
        self.client.upload_fileobj(
            body,
            self.bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )


def get_object_storage() -> ObjectStorage:
    return S3ObjectStorage()
