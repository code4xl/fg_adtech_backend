import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { BadRequestException } from "src/common/exceptions/custom.exception";

@Injectable()
export class LoginValidationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const { email, password } = req.body;

        if (!email && !password) {
            throw new BadRequestException("Email and Password are missing");
        }

        if (!email) {
            throw new BadRequestException("Email is missing");
        }

        if (!password) {
            throw new BadRequestException("Password is missing");
        }

        next();
    }
}