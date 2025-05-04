import { Test, TestingModule } from '@nestjs/testing';
import { CreativeController } from './creative.controller';
import { CreativeService } from './creative.service';

describe('CreativeController', () => {
  let controller: CreativeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreativeController],
      providers: [CreativeService],
    }).compile();

    controller = module.get<CreativeController>(CreativeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
